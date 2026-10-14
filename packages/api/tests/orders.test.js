import { afterEach, describe, expect, setSystemTime, test } from 'bun:test'
import { MAX_OPEN_ORDERS, ORDER_HOLD_MINUTES } from '@afriff/api/orders'
import { buy, CONTACT, signedIn, signUp } from './helpers'

const festivalPass = (quantity = 1) => ({ productId: 'prod_festival_pass', quantity })
const opening = (quantity = 1) => ({ productId: 'prod_opening', quantity })

const remainingOf = async (api, productId) =>
  (await api.catalog.listProducts()).find((product) => product.id === productId).remaining

async function firstBookableScreening(api) {
  const screenings = await api.programme.listScreenings()
  return screenings.find((screening) => screening.capacity - screening.sold > 2)
}

afterEach(() => setSystemTime())

describe('mock checkout', () => {
  test('opens a payment for the order and holds the stock while the attendee pays', async () => {
    const api = await signedIn()
    const before = await remainingOf(api, 'prod_opening')

    const intent = await api.orders.checkout({ items: [opening(2)], contact: CONTACT })
    expect(intent).toMatchObject({ provider: 'mock', email: 'ada@example.com', amount: { amount: 240_000_00, currency: 'NGN' } })
    expect(intent.reference).toMatch(/^AF-[A-Z0-9]{5}-1$/)
    expect(intent.accessCode).toBeTruthy()

    const order = await api.orders.get(intent.orderId)
    expect(order).toMatchObject({ status: 'pending', payment: { provider: 'mock', reference: intent.reference }, ticketIds: [] })
    expect(order.reference).toMatch(/^AF-[A-Z0-9]{5}$/)
    expect(Date.parse(order.holdExpiresAt) - Date.parse(order.placedAt)).toBe(ORDER_HOLD_MINUTES * 60_000)
    expect(order).not.toHaveProperty('userId')
    expect(order).not.toHaveProperty('attempts')
    expect(await remainingOf(api, 'prod_opening')).toBe(before - 2)
  })

  test('a successful payment issues one ticket per seat', async () => {
    const api = await signedIn()
    const order = await buy(api, [opening(2)])

    expect(order).toMatchObject({ status: 'paid', payment: { channel: 'card', last4: '4081', cardBrand: 'visa' } })
    expect(order.lines[0]).toMatchObject({ title: 'Opening Night Gala', quantity: 2 })
    expect(order.ticketIds).toHaveLength(2)
    expect(order.paidAt).toBeTruthy()
    expect(order.holdExpiresAt).toBeUndefined()

    const tickets = await api.tickets.list()
    expect(tickets).toHaveLength(2)
    expect(tickets[0]).toMatchObject({ orderId: order.id, status: 'valid', holderName: 'Ada Okoye' })
    expect(tickets[0].code).toMatch(/^AF-[A-Z0-9]{4}-[A-Z0-9]{4}$/)
    expect(tickets[0].venueName).toBeTruthy()
    expect(tickets[0]).not.toHaveProperty('userId')
  })

  test('asking again changes nothing once an order is paid', async () => {
    const api = await signedIn()
    const order = await buy(api, [festivalPass()])
    const again = await api.orders.verify(order.id)
    expect(again).toEqual(order)
    expect(await api.tickets.list()).toHaveLength(1)
    await expect(api.orders.pay(order.id)).rejects.toMatchObject({ code: 'conflict' })
  })

  test('a declined payment issues nothing and gives the stock back; a retry holds it again', async () => {
    const api = await signedIn()
    const before = await remainingOf(api, 'prod_opening')
    const order = await buy(api, [opening()], { outcome: 'failed' })

    expect(order).toMatchObject({ status: 'failed', payment: { failureReason: expect.stringContaining('declined') } })
    expect(order.ticketIds).toHaveLength(0)
    expect(await api.tickets.list()).toHaveLength(0)
    expect(await remainingOf(api, 'prod_opening')).toBe(before)

    const retry = await api.orders.pay(order.id)
    expect(retry.reference).toMatch(/-2$/)
    expect(await remainingOf(api, 'prod_opening')).toBe(before - 1)
    api.gateway.complete(retry.reference, 'success')
    expect((await api.orders.verify(order.id)).status).toBe('paid')
    expect(await api.tickets.list()).toHaveLength(1)
  })

  test('closing the checkout leaves the order waiting, and paying again resumes the same attempt', async () => {
    const api = await signedIn()
    const intent = await api.orders.checkout({ items: [festivalPass()], contact: CONTACT })
    expect((await api.orders.verify(intent.orderId)).status).toBe('pending')

    const resumed = await api.orders.pay(intent.orderId)
    expect(resumed.reference).toBe(intent.reference)
    expect(resumed.accessCode).toBe(intent.accessCode)

    api.gateway.complete(resumed.reference, 'success')
    expect((await api.orders.verify(intent.orderId)).status).toBe('paid')
  })

  test('paying for an order whose money already landed says so, and settles it', async () => {
    const api = await signedIn()
    const intent = await api.orders.checkout({ items: [festivalPass()], contact: CONTACT })
    api.gateway.complete(intent.reference, 'success')
    await expect(api.orders.pay(intent.orderId)).rejects.toMatchObject({ code: 'conflict' })
    expect((await api.orders.get(intent.orderId)).status).toBe('paid')
  })

  test('an unpaid order gives its stock back when the hold runs out', async () => {
    const api = await signedIn()
    const before = await remainingOf(api, 'prod_opening')
    const intent = await api.orders.checkout({ items: [opening()], contact: CONTACT })

    setSystemTime(new Date(Date.now() + (ORDER_HOLD_MINUTES + 1) * 60_000))
    const order = await api.orders.get(intent.orderId)
    expect(order).toMatchObject({ status: 'failed', payment: { failureReason: expect.stringContaining('ran out') } })
    expect(await remainingOf(api, 'prod_opening')).toBe(before)
  })

  test('money that lands after the hold still becomes tickets while there is stock', async () => {
    const api = await signedIn()
    const intent = await api.orders.checkout({ items: [opening()], contact: CONTACT })
    api.gateway.complete(intent.reference, 'success')
    setSystemTime(new Date(Date.now() + (ORDER_HOLD_MINUTES + 1) * 60_000))
    // The sweep checks with the provider before expiring, and finds the payment.
    expect((await api.orders.get(intent.orderId)).status).toBe('paid')
    expect(await api.tickets.list()).toHaveLength(1)
  })

  test(`allows ${MAX_OPEN_ORDERS} unpaid orders at once, so nobody can sit on the stock`, async () => {
    const api = await signedIn()
    for (let index = 0; index < MAX_OPEN_ORDERS; index += 1) {
      await api.orders.checkout({ items: [festivalPass()], contact: CONTACT })
    }
    await expect(api.orders.checkout({ items: [festivalPass()], contact: CONTACT })).rejects.toMatchObject({ code: 'conflict' })
  })

  test('describes what was bought, per product kind', async () => {
    const api = await signedIn()
    const screening = await firstBookableScreening(api)
    const order = await buy(api, [
      { productId: 'prod_day_pass', quantity: 1, selection: { day: '2026-11-03' } },
      { productId: 'prod_screening', quantity: 1, selection: { screeningId: screening.id } },
      { productId: 'prod_masterclass', quantity: 1, selection: { eventId: 'evt_mc_writing' } },
    ])
    const [dayPass, single, masterclass] = order.lines
    expect(dayPass.detail).toContain('Nov')
    expect(single.title).not.toBe('Single Screening')
    expect(single.detail).toMatch(/\d{2}:\d{2}/)
    expect(masterclass.title).toBeTruthy()
    expect((await api.tickets.list()).map((ticket) => ticket.title)).toContain(single.title)
  })

  test('insists on a choice where the product needs one', async () => {
    const api = await signedIn()
    for (const item of [
      { productId: 'prod_day_pass', quantity: 1 },
      { productId: 'prod_screening', quantity: 1 },
      { productId: 'prod_masterclass', quantity: 1 },
      { productId: 'prod_screening', quantity: 1, selection: { screeningId: 'scr_nope' } },
    ]) {
      await expect(api.orders.checkout({ items: [item], contact: CONTACT })).rejects.toMatchObject({ code: 'validation' })
    }
  })

  test('holds the per-order limit, the product stock and the screening seats', async () => {
    const api = await signedIn()
    await expect(api.orders.checkout({ items: [festivalPass(5)], contact: CONTACT }))
      .rejects.toMatchObject({ code: 'validation', details: { productId: 'prod_festival_pass' } })

    await expect(api.orders.checkout({
      items: [{ productId: 'prod_globe', quantity: 2 }, { productId: 'prod_globe', quantity: 2 }, { productId: 'prod_globe', quantity: 2 }],
      contact: CONTACT,
    })).rejects.toMatchObject({ code: 'validation' })

    const screenings = await api.programme.listScreenings()
    const full = screenings.find((screening) => screening.sold >= screening.capacity)
    if (full) {
      await expect(api.orders.checkout({
        items: [{ productId: 'prod_screening', quantity: 1, selection: { screeningId: full.id } }],
        contact: CONTACT,
      })).rejects.toMatchObject({ code: 'sold_out' })
    }
  })

  test('checks who the tickets are for before taking an order', async () => {
    const api = await signedIn()
    await expect(api.orders.checkout({ items: [], contact: CONTACT })).rejects.toMatchObject({ code: 'validation' })
    await expect(api.orders.checkout({ items: [festivalPass()], contact: { ...CONTACT, email: 'nope' } }))
      .rejects.toMatchObject({ code: 'validation', details: { field: 'contact.email' } })
  })

  test('keeps orders and tickets to their own account', async () => {
    const api = await signedIn()
    const order = await buy(api, [festivalPass()])
    expect((await api.orders.list()).map((item) => item.id)).toEqual([order.id])

    await api.auth.signOut()
    await expect(api.orders.list()).rejects.toMatchObject({ code: 'unauthorized' })
    await expect(api.orders.checkout({ items: [festivalPass()], contact: CONTACT })).rejects.toMatchObject({ code: 'unauthorized' })

    await signUp(api, { email: 'zainab@example.com', firstName: 'Zainab', lastName: 'Bello' })
    expect(await api.orders.list()).toHaveLength(0)
    expect(await api.tickets.list()).toHaveLength(0)
    await expect(api.orders.get(order.id)).rejects.toMatchObject({ code: 'not_found' })
    await expect(api.orders.verify(order.id)).rejects.toMatchObject({ code: 'not_found' })
    await expect(api.orders.pay(order.id)).rejects.toMatchObject({ code: 'not_found' })
  })
})

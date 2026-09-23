import { describe, expect, test } from 'bun:test'
import { createMockApi } from '@afriff/api/mock'

const PIN = '481902'
const ANY_CODE = '314159'
const GOOD_CARD = { method: 'card', cardName: 'Ada Okoye', cardNumber: '4111 1111 1111 1234', expiry: '11/29', cvv: '123' }
const DECLINED_CARD = { ...GOOD_CARD, cardNumber: '4111 1111 1111 0000' }
const PENDING_CARD = { ...GOOD_CARD, cardNumber: '4111 1111 1111 0001' }
const CONTACT = { name: 'Ada Okoye', email: 'ada@example.com', phone: '0803 123 4567' }

async function signedIn(email = 'ada@example.com') {
  const api = createMockApi({ latency: 0 })
  await api.auth.requestCode({ email, purpose: 'signup' })
  const ticket = await api.auth.verifyCode({ email, code: ANY_CODE })
  await api.auth.setPin({ ticket: ticket.token, pin: PIN, name: 'Ada Okoye' })
  return api
}

const festivalPass = (quantity = 1) => ({ productId: 'prod_festival_pass', quantity })

async function firstBookableScreening(api) {
  const screenings = await api.programme.listScreenings()
  return screenings.find((screening) => screening.capacity - screening.sold > 2)
}

describe('mock checkout', () => {
  test('pays by card, issues one ticket per seat and holds the stock', async () => {
    const api = await signedIn()
    const before = (await api.catalog.listProducts()).find((product) => product.id === 'prod_opening')

    const order = await api.orders.checkout({
      items: [{ productId: 'prod_opening', quantity: 2 }],
      contact: CONTACT,
      payment: GOOD_CARD,
    })

    expect(order).toMatchObject({ status: 'paid', payment: { method: 'card', last4: '1234' } })
    expect(order.reference).toMatch(/^AF-[A-Z0-9]{5}$/)
    expect(order.total.amount).toBe(240_000_00)
    expect(order.lines[0]).toMatchObject({ title: 'Opening Night Gala', quantity: 2 })
    expect(order.ticketIds).toHaveLength(2)
    expect(order.paidAt).toBeTruthy()

    const tickets = await api.tickets.list()
    expect(tickets).toHaveLength(2)
    expect(tickets[0]).toMatchObject({ orderId: order.id, status: 'valid', holderName: 'Ada Okoye' })
    expect(tickets[0].code).toMatch(/^AF-[A-Z0-9]{4}-[A-Z0-9]{4}$/)
    expect(tickets[0].venueName).toBeTruthy()
    expect(tickets[0]).not.toHaveProperty('userId')

    const after = (await api.catalog.listProducts()).find((product) => product.id === 'prod_opening')
    expect(after.remaining).toBe(before.remaining - 2)
  })

  test('issues no tickets for a declined card and gives the stock back', async () => {
    const api = await signedIn()
    const order = await api.orders.checkout({
      items: [{ productId: 'prod_opening', quantity: 1 }],
      contact: CONTACT,
      payment: DECLINED_CARD,
    })
    expect(order).toMatchObject({ status: 'failed', payment: { failureReason: expect.any(String) } })
    expect(order.ticketIds).toHaveLength(0)
    expect(await api.tickets.list()).toHaveLength(0)

    const product = (await api.catalog.listProducts()).find((item) => item.id === 'prod_opening')
    expect(product.remaining).toBe(40)

    const retried = await api.orders.pay(order.id, GOOD_CARD)
    expect(retried.status).toBe('paid')
    expect(await api.tickets.list()).toHaveLength(1)
    await expect(api.orders.pay(order.id, GOOD_CARD)).rejects.toMatchObject({ code: 'conflict' })
  })

  test('leaves a pending card payment without tickets until it clears', async () => {
    const api = await signedIn()
    const order = await api.orders.checkout({ items: [festivalPass()], contact: CONTACT, payment: PENDING_CARD })
    expect(order.status).toBe('pending')
    expect(await api.tickets.list()).toHaveLength(0)
    expect((await api.orders.get(order.id)).status).toBe('pending')

    const paid = await api.orders.pay(order.id, GOOD_CARD)
    expect(paid.status).toBe('paid')
    expect(await api.tickets.list()).toHaveLength(1)
  })

  test('waits for a transfer, then issues the tickets when it is confirmed', async () => {
    const api = await signedIn()
    const order = await api.orders.checkout({
      items: [festivalPass(2)],
      contact: CONTACT,
      payment: { method: 'transfer' },
    })
    expect(order).toMatchObject({ status: 'pending', payment: { method: 'transfer', reference: order.reference } })
    expect(await api.tickets.list()).toHaveLength(0)

    const paid = await api.orders.confirmTransfer(order.id)
    expect(paid.status).toBe('paid')
    expect(paid.ticketIds).toHaveLength(2)
    expect(await api.orders.confirmTransfer(order.id)).toMatchObject({ status: 'paid', ticketIds: paid.ticketIds })
  })

  test('describes what was bought, per product kind', async () => {
    const api = await signedIn()
    const screening = await firstBookableScreening(api)
    const order = await api.orders.checkout({
      items: [
        { productId: 'prod_day_pass', quantity: 1, selection: { day: '2026-11-03' } },
        { productId: 'prod_screening', quantity: 1, selection: { screeningId: screening.id } },
        { productId: 'prod_masterclass', quantity: 1, selection: { eventId: 'evt_mc_writing' } },
      ],
      contact: CONTACT,
      payment: GOOD_CARD,
    })
    const [dayPass, single, masterclass] = order.lines
    expect(dayPass.detail).toContain('Nov')
    expect(single.title).not.toBe('Single Screening')
    expect(single.detail).toMatch(/\d{2}:\d{2}/)
    expect(masterclass.title).toBeTruthy()
    expect((await api.tickets.list()).map((ticket) => ticket.title)).toContain(single.title)
  })

  test('insists on a choice where the product needs one', async () => {
    const api = await signedIn()
    const cases = [
      [{ productId: 'prod_day_pass', quantity: 1 }, 'selection.day'],
      [{ productId: 'prod_screening', quantity: 1 }, 'selection.screeningId'],
      [{ productId: 'prod_masterclass', quantity: 1 }, 'selection.eventId'],
    ]
    for (const [item] of cases) {
      await expect(api.orders.checkout({ items: [item], contact: CONTACT, payment: GOOD_CARD }))
        .rejects.toMatchObject({ code: 'validation' })
    }
    await expect(api.orders.checkout({
      items: [{ productId: 'prod_screening', quantity: 1, selection: { screeningId: 'scr_nope' } }],
      contact: CONTACT,
      payment: GOOD_CARD,
    })).rejects.toMatchObject({ code: 'validation' })
  })

  test('holds the per-order limit, the product stock and the screening seats', async () => {
    const api = await signedIn()
    await expect(api.orders.checkout({ items: [festivalPass(5)], contact: CONTACT, payment: GOOD_CARD }))
      .rejects.toMatchObject({ code: 'validation', details: { productId: 'prod_festival_pass' } })

    await expect(api.orders.checkout({
      items: [{ productId: 'prod_globe', quantity: 2 }, { productId: 'prod_globe', quantity: 2 }, { productId: 'prod_globe', quantity: 2 }],
      contact: CONTACT,
      payment: GOOD_CARD,
    })).rejects.toMatchObject({ code: 'validation' })

    const screenings = await api.programme.listScreenings()
    const full = screenings.find((screening) => screening.sold >= screening.capacity)
    if (full) {
      await expect(api.orders.checkout({
        items: [{ productId: 'prod_screening', quantity: 1, selection: { screeningId: full.id } }],
        contact: CONTACT,
        payment: GOOD_CARD,
      })).rejects.toMatchObject({ code: 'sold_out' })
    }
  })

  test('checks the card details before taking an order', async () => {
    const api = await signedIn()
    await expect(api.orders.checkout({
      items: [festivalPass()],
      contact: CONTACT,
      payment: { ...GOOD_CARD, expiry: '13/29' },
    })).rejects.toMatchObject({ code: 'validation' })
    await expect(api.orders.checkout({ items: [], contact: CONTACT, payment: GOOD_CARD }))
      .rejects.toMatchObject({ code: 'validation' })
    await expect(api.orders.checkout({
      items: [festivalPass()],
      contact: { ...CONTACT, email: 'nope' },
      payment: GOOD_CARD,
    })).rejects.toMatchObject({ code: 'validation' })
  })

  test('keeps orders and tickets to their own account', async () => {
    const api = await signedIn()
    const order = await api.orders.checkout({ items: [festivalPass()], contact: CONTACT, payment: GOOD_CARD })
    expect((await api.orders.list()).map((item) => item.id)).toEqual([order.id])

    await api.auth.signOut()
    await expect(api.orders.list()).rejects.toMatchObject({ code: 'unauthorized' })
    await expect(api.orders.checkout({ items: [festivalPass()], contact: CONTACT, payment: GOOD_CARD }))
      .rejects.toMatchObject({ code: 'unauthorized' })

    await api.auth.requestCode({ email: 'zainab@example.com', purpose: 'signup' })
    const ticket = await api.auth.verifyCode({ email: 'zainab@example.com', code: ANY_CODE })
    await api.auth.setPin({ ticket: ticket.token, pin: '730264', name: 'Zainab Bello' })
    expect(await api.orders.list()).toHaveLength(0)
    expect(await api.tickets.list()).toHaveLength(0)
    await expect(api.orders.get(order.id)).rejects.toMatchObject({ code: 'not_found' })
  })
})

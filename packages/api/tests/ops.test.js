import { describe, expect, test } from 'bun:test'
import { canDo, draftForCancel, draftForMove, movedScreening, parseOpsQuery, ticketPatch, toLagosIso } from '@afriff/api/ops'
import { createMockOpsApi, MOCK_OPS } from '@afriff/api/mock/ops'
import * as seed from '@afriff/api/seed'

const screening = seed.screenings.find((item) => item.format === 'Standard' && item.sold > 0)
const film = seed.films.find((item) => item.id === screening.filmId)
const BEFORE_FESTIVAL = new Date('2026-10-14T12:00:00+01:00')
const sameScreenLater = (hours) => ({ screeningId: screening.id, startsAt: toLagosIso(Date.parse(screening.startsAt) + hours * 3_600_000), screenId: screening.screenId })

describe('who may do what', () => {
  test('ops and admins run the console; only admins manage staff; door staff do neither', () => {
    expect(canDo('ops', 'moveScreening')).toBe(true)
    expect(canDo('ops', 'inviteStaff')).toBe(false)
    expect(canDo('admin', 'setStaffRole')).toBe(true)
    expect(canDo('door', 'publishUpdate')).toBe(false)
    expect(canDo(undefined, 'publishUpdate')).toBe(false)
  })
})

describe('the search box', () => {
  test('tells references, ticket codes and emails apart', () => {
    expect(parseOpsQuery(' af-7kq2p ')).toEqual({ kind: 'reference', value: 'AF-7KQ2P' })
    expect(parseOpsQuery('af 7kq2 p4nr')).toEqual({ kind: 'code', value: 'AF-7KQ2-P4NR' })
    expect(parseOpsQuery('AF7KQ2P4NR')).toEqual({ kind: 'code', value: 'AF-7KQ2-P4NR' })
    expect(parseOpsQuery('Ada@Example.com')).toEqual({ kind: 'email', value: 'ada@example.com' })
    expect(parseOpsQuery('ada')).toBeNull()
  })
})

describe('moving a screening', () => {
  test('keeps its length and writes the time in Lagos time', () => {
    const after = movedScreening(screening, sameScreenLater(2.5), seed.venues, BEFORE_FESTIVAL)
    expect(Date.parse(after.endsAt) - Date.parse(after.startsAt)).toBe(Date.parse(screening.endsAt) - Date.parse(screening.startsAt))
    expect(after.startsAt).toMatch(/\+01:00$/)
    expect(Date.parse(after.startsAt) - Date.parse(screening.startsAt)).toBe(2.5 * 3_600_000)
  })

  test('takes the new screen’s seats, and refuses one too small for what is sold', () => {
    const big = seed.venues.flatMap((venue) => venue.screens).find((item) => item.capacity >= screening.sold && item.id !== screening.screenId)
    expect(movedScreening(screening, { ...sameScreenLater(0), screenId: big.id }, seed.venues, BEFORE_FESTIVAL).capacity).toBe(big.capacity)
    const sold = { ...screening, sold: 10_000 }
    expect(() => movedScreening(sold, { ...sameScreenLater(0), screenId: big.id }, seed.venues, BEFORE_FESTIVAL)).toThrow('already sold')
  })

  test('refuses the past, an unknown screen and a cancelled screening', () => {
    expect(() => movedScreening(screening, sameScreenLater(-10_000), seed.venues, BEFORE_FESTIVAL)).toThrow('has not passed')
    expect(() => movedScreening(screening, { ...sameScreenLater(1), screenId: 'scr_nope' }, seed.venues, BEFORE_FESTIVAL)).toThrow('Pick a screen')
    expect(() => movedScreening({ ...screening, cancelled: true }, sameScreenLater(1), seed.venues, BEFORE_FESTIVAL)).toThrow('cancelled')
  })

  test('brings the copies on its tickets up to date', () => {
    const after = movedScreening(screening, sameScreenLater(1), seed.venues, BEFORE_FESTIVAL)
    const patch = ticketPatch(after, seed.venues.find((venue) => venue.id === after.venueId))
    expect(patch.startsAt).toBe(after.startsAt)
    expect(patch.subtitle).toContain(patch.roomName)
  })
})

describe('the drafted announcements', () => {
  test('a move is urgent, about the screening, and says the ticket stands', () => {
    const after = movedScreening(screening, sameScreenLater(2), seed.venues, BEFORE_FESTIVAL)
    const draft = draftForMove(screening, after, film, seed.venues)
    expect(draft).toMatchObject({ kind: 'schedule', severity: 'urgent', subject: { screeningId: screening.id } })
    expect(draft.title).toContain(film.title)
    expect(draft.body).toContain('Your ticket stands')
    expect(`${draft.title} ${draft.body}`).not.toMatch(/[–—]/)
  })

  test('a cancellation says refunds are automatic and passes are unaffected', () => {
    const draft = draftForCancel(screening, film, seed.venues.find((venue) => venue.id === screening.venueId))
    expect(draft.title).toContain('cancelled')
    expect(draft.body).toContain('refunded in full')
    expect(draft.body).toContain('Passes are not affected')
  })
})

describe('the mock console', () => {
  const signedIn = async () => {
    const ops = createMockOpsApi({ latency: 0 })
    await ops.auth.signIn({ email: MOCK_OPS.email, password: MOCK_OPS.password })
    return ops
  }

  test('only the demo account signs in, and nothing works signed out', async () => {
    const ops = createMockOpsApi({ latency: 0 })
    await expect(ops.auth.signIn({ email: MOCK_OPS.email, password: 'nope' })).rejects.toMatchObject({ code: 'unauthorized' })
    await expect(ops.overview()).rejects.toMatchObject({ code: 'unauthorized' })
  })

  test('has demo orders to work with, including refunds waiting', async () => {
    const ops = await signedIn()
    const overview = await ops.overview()
    expect(overview.paidOrders).toBeGreaterThan(20)
    expect(overview.revenue.amount).toBeGreaterThan(0)
    expect(overview.refundsDue).toBe(2)
    expect((await ops.orders.refundsDue()).length).toBe(2)
  })

  test('moving a screening brings its tickets along, and the log says so', async () => {
    const ops = await signedIn()
    const { screenings } = await ops.programme()
    const busy = (await Promise.all(screenings.map(async (item) => ({ item, tickets: await ops.ticketsFor({ kind: 'screening', id: item.id }) }))))
      .find((entry) => entry.tickets.length > 0)
    const target = toLagosIso(Date.parse(busy.item.startsAt) + 2 * 3_600_000)
    const change = await ops.act('moveScreening', { screeningId: busy.item.id, startsAt: target, screenId: busy.item.screenId })
    expect(change.ticketsAffected).toBe(busy.tickets.length)
    expect(change.before.startsAt).toBe(busy.item.startsAt)
    expect(change.after.startsAt).toBe(target)
    expect((await ops.ticketsFor({ kind: 'screening', id: busy.item.id })).every((ticket) => ticket.startsAt === target)).toBe(true)
    const [entry] = await ops.audit()
    expect(entry).toMatchObject({ action: 'moveScreening', target: { kind: 'screening', id: busy.item.id } })
  })

  test('cancelling voids the single tickets, flags their orders, and the update reaches the holders', async () => {
    const ops = await signedIn()
    const { screenings } = await ops.programme()
    let target
    for (const item of screenings) {
      const tickets = (await ops.ticketsFor({ kind: 'screening', id: item.id })).filter((ticket) => ticket.status === 'valid')
      if (tickets.length) {
        target = { item, tickets }
        break
      }
    }
    const before = (await ops.overview()).refundsDue
    const change = await ops.act('cancelScreening', { screeningId: target.item.id })
    expect(change.after.cancelled).toBe(true)
    expect(change.ticketsAffected).toBe(target.tickets.length)
    expect((await ops.overview()).refundsDue).toBe(before + change.ordersFlagged)
    expect((await ops.ticketsFor({ kind: 'screening', id: target.item.id })).every((ticket) => ticket.status === 'void' && ticket.voidReason)).toBe(true)

    const { update, emailed } = await ops.act('publishUpdate', { ...change.draft, emailTicketHolders: true })
    expect(update.subject.screeningId).toBe(target.item.id)
    expect(emailed).toBeGreaterThan(0)
    await expect(ops.act('cancelScreening', { screeningId: target.item.id })).rejects.toMatchObject({ code: 'conflict' })
  })

  test('refunds, voids and reissues', async () => {
    const ops = await signedIn()
    const [owed] = await ops.orders.refundsDue()
    await expect(ops.act('markRefunded', { orderId: owed.id, note: '' })).rejects.toMatchObject({ code: 'validation' })
    const done = await ops.act('markRefunded', { orderId: owed.id, note: 'Refunded in Paystack, ref RF-123' })
    expect(done).toMatchObject({ refundDue: false, refundNote: 'Refunded in Paystack, ref RF-123' })

    const paid = (await ops.orders.recent()).find((order) => order.status === 'paid' && order.ticketIds.length)
    const detail = await ops.orders.get(paid.id)
    expect(detail.mail[0]).toMatchObject({ template: 'order_paid', status: 'sent' })
    const [ticket] = detail.tickets
    const fresh = await ops.act('reissueTicket', { ticketId: ticket.id })
    expect(fresh.code).not.toBe(ticket.code)
    expect((await ops.orders.get(paid.id)).order.ticketIds).toContain(fresh.id)
    const voided = await ops.act('voidTicket', { ticketId: fresh.id, reason: 'Duplicate purchase', refund: true })
    expect(voided).toMatchObject({ status: 'void', voidReason: 'Duplicate purchase' })
    expect((await ops.orders.get(paid.id)).order.refundDue).toBe(true)
  })

  test('search finds an order by reference, email or ticket code', async () => {
    const ops = await signedIn()
    const paid = (await ops.orders.recent()).find((order) => order.status === 'paid' && order.ticketIds.length)
    const { tickets } = await ops.orders.get(paid.id)
    expect((await ops.orders.search(paid.reference.toLowerCase())).map((order) => order.id)).toEqual([paid.id])
    expect((await ops.orders.search(paid.contact.email)).map((order) => order.id)).toContain(paid.id)
    expect((await ops.orders.search(tickets[0].code)).map((order) => order.id)).toEqual([paid.id])
    await expect(ops.orders.search('who?')).rejects.toMatchObject({ code: 'validation' })
  })

  test('products and staff', async () => {
    const ops = await signedIn()
    const product = await ops.act('updateProduct', { productId: 'prod_festival_pass', priceNaira: 80_000, remaining: 150, maxPerOrder: 4 })
    expect(product).toMatchObject({ price: { amount: 80_000_00 }, remaining: 150 })
    const staff = await ops.act('listStaff', {})
    const { staff: invited } = await ops.act('inviteStaff', { email: 'New.Door@afriff.test', name: 'New door', role: 'door' })
    expect(invited).toMatchObject({ email: 'new.door@afriff.test', role: 'door', active: true })
    expect(await ops.act('listStaff', {})).toHaveLength(staff.length + 1)
    const me = staff.find((item) => item.email === MOCK_OPS.email)
    await expect(ops.act('setStaffRole', { uid: me.id, role: null })).rejects.toMatchObject({ code: 'conflict' })
    expect(await ops.act('setStaffRole', { uid: invited.id, role: null })).toMatchObject({ active: false })
  })
})

import { describe, expect, test } from 'bun:test'
import { createMockApi } from '@afriff/api/mock'
import { ticketAdmits, ticketIcs, ticketIcsFilename, ticketPayload, ticketState } from '@afriff/api/tickets'

const PIN = '481902'
const ANY_CODE = '314159'
const CARD = { method: 'card', cardName: 'Ada Okoye', cardNumber: '4111 1111 1111 1234', expiry: '11/29', cvv: '123' }
const CONTACT = { name: 'Ada Okoye', email: 'ada@example.com', phone: '0803 123 4567' }

async function signUp(api, email, name) {
  const [firstName, lastName] = name.split(' ')
  await api.auth.requestCode({ email, purpose: 'signup' })
  const ticket = await api.auth.verifyCode({ email, code: ANY_CODE })
  await api.auth.setPin({ ticket: ticket.token, pin: PIN, firstName, lastName })
}

/** One paid screening ticket, and the API it lives in. */
async function boughtTicket() {
  const api = createMockApi({ latency: 0 })
  await signUp(api, 'ada@example.com', 'Ada Okoye')
  const screenings = await api.programme.listScreenings()
  const screening = screenings.find((item) => item.capacity - item.sold > 2)
  await api.orders.checkout({
    items: [{ productId: 'prod_screening', quantity: 1, selection: { screeningId: screening.id } }],
    contact: CONTACT,
    payment: CARD,
  })
  const [ticket] = await api.tickets.list()
  return { api, ticket, screening }
}

describe('tickets.get', () => {
  test('returns the attendee’s own ticket, with everything the door needs', async () => {
    const { api, ticket, screening } = await boughtTicket()
    const found = await api.tickets.get(ticket.id)
    expect(found).toMatchObject({ id: ticket.id, code: ticket.code, status: 'valid', holderName: 'Ada Okoye' })
    expect(found.startsAt).toBe(screening.startsAt)
    expect(found.endsAt).toBe(screening.endsAt)
    expect(found.venueName).toBeTruthy()
    expect(found.roomName).toBeTruthy()
    expect(found).not.toHaveProperty('userId')
  })

  test('does not hand a ticket to anyone else', async () => {
    const { api, ticket } = await boughtTicket()
    await api.auth.signOut()
    await signUp(api, 'bem@example.com', 'Bem Tersoo')
    await expect(api.tickets.get(ticket.id)).rejects.toMatchObject({ code: 'not_found' })
  })

  test('needs a signed-in attendee', async () => {
    const { api, ticket } = await boughtTicket()
    await api.auth.signOut()
    await expect(api.tickets.get(ticket.id)).rejects.toMatchObject({ code: 'unauthorized' })
  })
})

describe('tickets.transfer', () => {
  test('passes the ticket on and leaves the sender a record of where it went', async () => {
    const { api, ticket } = await boughtTicket()
    const sent = await api.tickets.transfer(ticket.id, { email: 'Bem@Example.com', name: 'Bem Tersoo' })

    expect(sent).toMatchObject({ id: ticket.id, status: 'transferred' })
    expect(sent.transfer).toMatchObject({ toEmail: 'bem@example.com', toName: 'Bem Tersoo' })
    expect(ticketAdmits(sent)).toBe(false)

    const mine = await api.tickets.list()
    expect(mine).toHaveLength(1)
    expect(mine[0].status).toBe('transferred')
  })

  test('the ticket is waiting when the recipient makes an account', async () => {
    const { api, ticket } = await boughtTicket()
    await api.tickets.transfer(ticket.id, { email: 'bem@example.com', name: 'Bem Tersoo' })

    await api.auth.signOut()
    await signUp(api, 'bem@example.com', 'Bem Tersoo')

    const theirs = await api.tickets.list()
    expect(theirs).toHaveLength(1)
    expect(theirs[0]).toMatchObject({ status: 'valid', holderName: 'Bem Tersoo', title: ticket.title })
    expect(theirs[0].id).not.toBe(ticket.id)
    expect(theirs[0].code).not.toBe(ticket.code)
    expect(theirs[0].origin).toMatchObject({ fromName: 'Ada Okoye' })
  })

  test('will not pass the same ticket on twice', async () => {
    const { api, ticket } = await boughtTicket()
    await api.tickets.transfer(ticket.id, { email: 'bem@example.com' })
    await expect(api.tickets.transfer(ticket.id, { email: 'chidi@example.com' })).rejects.toMatchObject({
      code: 'conflict',
    })
  })

  test('refuses your own address and a bad one', async () => {
    const { api, ticket } = await boughtTicket()
    await expect(api.tickets.transfer(ticket.id, { email: 'ada@example.com' })).rejects.toMatchObject({
      code: 'validation',
      details: { field: 'email' },
    })
    await expect(api.tickets.transfer(ticket.id, { email: 'not-an-email' })).rejects.toMatchObject({
      code: 'validation',
    })
  })
})

describe('ticket helpers', () => {
  const base = {
    id: 'tkt_1',
    code: 'AF-7KQ2-P4NR',
    orderId: 'ord_1',
    productId: 'prod_screening',
    productName: 'Single Screening',
    kind: 'single',
    status: 'valid',
    holderName: 'Ada Okoye',
    title: 'Salt Roads',
    subtitle: 'Tue 3 Nov, 18:30 · Landmark',
    startsAt: '2026-11-03T18:30:00+01:00',
    endsAt: '2026-11-03T20:22:00+01:00',
    venueName: 'Landmark Event Centre',
    issuedAt: '2026-10-01T09:00:00+01:00',
  }

  test('the payload carries the version, the ticket and its code', () => {
    expect(ticketPayload(base)).toBe('AF1|tkt_1|AF-7KQ2-P4NR|2026-11-03T18:30:00+01:00')
    expect(ticketPayload({ ...base, startsAt: undefined })).toBe('AF1|tkt_1|AF-7KQ2-P4NR|open')
  })

  test('a ticket expires when its screening is over, and a pass never does', () => {
    const during = new Date('2026-11-03T19:00:00+01:00')
    const after = new Date('2026-11-04T09:00:00+01:00')
    expect(ticketState(base, during)).toBe('valid')
    expect(ticketState(base, after)).toBe('expired')
    expect(ticketAdmits(base, after)).toBe(false)
    expect(ticketState({ ...base, startsAt: undefined, endsAt: undefined }, after)).toBe('valid')
    expect(ticketState({ ...base, status: 'used' }, during)).toBe('used')
    expect(ticketState({ ...base, status: 'transferred' }, during)).toBe('transferred')
  })

  test('the calendar file has the times in UTC and escapes what it must', () => {
    const ics = ticketIcs({ ...base, title: 'Salt Roads, part two' }, new Date('2026-10-02T10:00:00Z'))
    expect(ics).toContain('BEGIN:VEVENT')
    expect(ics).toContain('DTSTART:20261103T173000Z')
    expect(ics).toContain('DTEND:20261103T192200Z')
    expect(ics).toContain('SUMMARY:Salt Roads\\, part two')
    expect(ics).toContain('LOCATION:Landmark Event Centre')
    expect(ics).toContain('UID:tkt_1@afriff.com')
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true)
    expect(ics.split('\r\n').every((line) => line.length <= 75)).toBe(true)
  })

  test('assumes two hours when a ticket carries no end time', () => {
    const ics = ticketIcs({ ...base, endsAt: undefined }, new Date('2026-10-02T10:00:00Z'))
    expect(ics).toContain('DTEND:20261103T193000Z')
  })

  test('has nothing to put in a calendar for an undated pass', () => {
    expect(ticketIcs({ ...base, startsAt: undefined, endsAt: undefined })).toBeNull()
  })

  test('names the download after the ticket', () => {
    expect(ticketIcsFilename(base)).toBe('afriff-salt-roads.ics')
    expect(ticketIcsFilename({ ...base, title: 'Àbèní: the Return' })).toBe('afriff-abeni-the-return.ics')
  })
})

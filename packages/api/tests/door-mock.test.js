import { describe, expect, test } from 'bun:test'
import { createMockDoorApi, MOCK_STAFF } from '@afriff/api/mock/door'

const newDoor = async () => {
  const door = createMockDoorApi({ latency: 0 })
  await door.auth.signIn({ email: MOCK_STAFF.email, password: MOCK_STAFF.password })
  return door
}

const during = (session) => new Date(Date.parse(session.startsAt) + 10 * 60_000).toISOString()

async function sessionWhere(door, test) {
  return (await door.sessions()).find(test)
}

describe('the mock door', () => {
  test('signs in only the demo door account', async () => {
    const door = createMockDoorApi({ latency: 0 })
    expect(await door.auth.restore()).toBeNull()
    await expect(door.auth.signIn({ email: MOCK_STAFF.email, password: 'wrong' })).rejects.toMatchObject({ code: 'unauthorized' })
    const staff = await door.auth.signIn({ email: MOCK_STAFF.email, password: MOCK_STAFF.password })
    expect(staff).toMatchObject({ email: MOCK_STAFF.email, role: 'door' })
    await door.auth.signOut()
    expect(await door.auth.restore()).toBeNull()
  })

  test('needs a signed-in door to scan', async () => {
    const door = createMockDoorApi({ latency: 0 })
    const [session] = await door.sessions()
    await expect(door.checkIn({ session: session.ref, scan: 'AF-ZZZZ-ZZZZ' })).rejects.toMatchObject({ code: 'unauthorized' })
  })

  test('every demo ticket at a standard screening gets the result the rules give it', async () => {
    const door = await newDoor()
    const session = await sessionWhere(door, (item) => item.format === 'Standard' && item.startsAt.startsWith('2026-11-03'))
    const at = during(session)
    const outcomes = {}
    for (const ticket of door.demoTickets(session.ref)) {
      outcomes[ticket.label] = (await door.checkIn({ session: session.ref, scan: ticket.scan, at })).outcome
    }
    expect(outcomes).toEqual({
      'Single ticket for this screening': 'admitted',
      'Festival Pass': 'admitted',
      'Day Pass for this day': 'admitted',
      'Day Pass for another day': 'wrong_session',
      'Single ticket for another screening': 'wrong_session',
      'Passed on to someone else': 'passed_on',
      'Cancelled (void)': 'void',
      'A code that is not ours': 'unknown',
    })
  })

  test('a second scan finds the first, with when and by whom, and the count keeps up', async () => {
    const door = await newDoor()
    const session = await sessionWhere(door, (item) => item.format === 'Standard')
    const counts = []
    const stop = door.watchCount(session.ref, (count) => counts.push(count.admitted))
    const [single] = door.demoTickets(session.ref)
    const at = during(session)

    const first = await door.checkIn({ session: session.ref, scan: single.scan, at })
    expect(first).toMatchObject({ outcome: 'admitted', ticket: { holderName: single.holderName }, count: { admitted: 1, passAdmitted: 0 } })
    const second = await door.checkIn({ session: session.ref, scan: single.scan, at })
    expect(second).toMatchObject({ outcome: 'already_in', previous: { at: first.at, byName: 'Door team (demo)' } })
    expect(counts).toEqual([0, 1])
    stop()
  })

  test('the printed code typed in works as well as the QR code', async () => {
    const door = await newDoor()
    const session = await sessionWhere(door, (item) => item.format === 'Standard')
    const [single] = door.demoTickets(session.ref)
    const code = single.scan.split('|')[2]
    const typed = code.toLowerCase().replace(/-/g, ' ')
    expect((await door.checkIn({ session: session.ref, scan: typed, at: during(session) })).outcome).toBe('admitted')
  })

  test('the rehearsal clock decides whether the doors are open', async () => {
    const door = await newDoor()
    const session = await sessionWhere(door, (item) => item.format === 'Standard')
    const [single] = door.demoTickets(session.ref)
    const early = new Date(Date.parse(session.startsAt) - 3 * 60 * 60_000).toISOString()
    const late = new Date(Date.parse(session.endsAt) + 60_000).toISOString()
    expect((await door.checkIn({ session: session.ref, scan: single.scan, at: early })).outcome).toBe('too_early')
    expect((await door.checkIn({ session: session.ref, scan: single.scan, at: late })).outcome).toBe('ended')
  })

  test('panels sell no tickets of their own, so the demo set starts with a pass', async () => {
    const door = await newDoor()
    const panel = await sessionWhere(door, (item) => item.eventKind === 'panel')
    const demo = door.demoTickets(panel.ref)
    expect(demo[0].label).toBe('Festival Pass')
    expect((await door.checkIn({ session: panel.ref, scan: demo[0].scan, at: during(panel) })).outcome).toBe('admitted')
  })

  test('the gala screening admits its gala’s ticket and refuses a pass', async () => {
    const door = await newDoor()
    const gala = await sessionWhere(door, (item) => item.format === 'Gala')
    const [galaTicket, festivalPass] = door.demoTickets(gala.ref)
    expect(galaTicket.label).toBe('Opening Night Gala ticket')
    expect((await door.checkIn({ session: gala.ref, scan: galaTicket.scan, at: during(gala) })).outcome).toBe('admitted')
    expect((await door.checkIn({ session: gala.ref, scan: festivalPass.scan, at: during(gala) })).outcome).toBe('wrong_session')
  })
})

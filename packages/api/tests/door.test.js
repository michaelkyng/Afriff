import { describe, expect, test } from 'bun:test'
import { decideCheckIn, doorSessions, doorsOpenAt, NO_COUNT, parseScan, sessionKey, ticketCovers } from '@afriff/api/door'
import { ticketPayload } from '@afriff/api/tickets'
import * as seed from '@afriff/api/seed'

/** The door rules on the placeholder programme, the way staff will meet it. */

const sessions = doorSessions(seed)
const events = new Map(seed.events.map((event) => [event.id, event]))
const eventOf = (id) => events.get(id)
const session = (kind, id) => sessions.find((item) => item.ref.kind === kind && item.ref.id === id)

const standard = sessions.find((item) => item.ref.kind === 'screening' && item.format === 'Standard' && item.startsAt.startsWith('2026-11-03'))
const otherDay = sessions.find((item) => item.ref.kind === 'screening' && item.format === 'Standard' && item.startsAt.startsWith('2026-11-04'))
const gala = session('screening', 'scn_gala_opening')
const opening = session('event', 'evt_opening')
const masterclass = session('event', 'evt_mc_producing')
const panel = session('event', 'evt_panel_coprod')
const mixer = session('event', 'evt_mixer')

const ticket = (kind, selection, status = 'valid') => ({ kind, selection, status })
const festivalPass = ticket('festival_pass')
const dayPass = (day) => ticket('day_pass', { day })
const single = (screeningId) => ticket('screening', { screeningId })
const eventTicket = (kind, eventId) => ticket(kind, { eventId })

/** Ten minutes after the start: the doors are open and it is not over. */
const during = (item) => new Date(Date.parse(item.startsAt) + 10 * 60_000)
const decide = (overrides) => decideCheckIn({ previous: null, count: NO_COUNT, eventOf, ...overrides })

describe('the sessions a door can check into', () => {
  test('every screening and event, earliest first, described for the door', () => {
    expect(sessions).toHaveLength(seed.screenings.length + seed.events.length)
    expect(sessions.map((item) => item.startsAt)).toEqual(sessions.map((item) => item.startsAt).sort())
    expect(standard.place).toMatch(/, /)
    expect(standard.capacity).toBeGreaterThan(0)
    expect(masterclass.capacity).toBeNull()
    expect(sessionKey(standard.ref)).toBe(`screening_${standard.ref.id}`)
  })
})

describe('reading a scan', () => {
  test('takes the QR payload', () => {
    const payload = ticketPayload({ id: 'tkt_abc', code: 'AF-7KQ2-P4NR', startsAt: '2026-11-03T18:30:00+01:00' })
    expect(parseScan(payload)).toEqual({ ticketId: 'tkt_abc', code: 'AF-7KQ2-P4NR' })
  })

  test('takes a printed code typed in any case and spacing', () => {
    for (const typed of ['AF-7KQ2-P4NR', 'af-7kq2-p4nr', ' af 7kq2 p4nr ', 'AF7KQ2P4NR']) {
      expect(parseScan(typed)).toEqual({ code: 'AF-7KQ2-P4NR' })
    }
  })

  test('refuses anything else, including letters the codes never use', () => {
    for (const junk of ['', 'hello', 'AF-7KQ2', 'AF-7KQ2-P4N0', 'AF-IIII-OOOO', 'AF1|tkt_abc|nope|x', 'https://example.com']) {
      expect(parseScan(junk)).toBeNull()
    }
  })
})

describe('what a ticket covers', () => {
  test('a festival pass: standard screenings, panels and the Mixer, but no gala or masterclass', () => {
    expect(ticketCovers(festivalPass, standard, eventOf)).toBe(true)
    expect(ticketCovers(festivalPass, panel, eventOf)).toBe(true)
    expect(ticketCovers(festivalPass, mixer, eventOf)).toBe(true)
    expect(ticketCovers(festivalPass, gala, eventOf)).toBe(false)
    expect(ticketCovers(festivalPass, opening, eventOf)).toBe(false)
    expect(ticketCovers(festivalPass, masterclass, eventOf)).toBe(false)
  })

  test('a day pass: standard screenings and panels on its day only, not the Mixer', () => {
    expect(ticketCovers(dayPass('2026-11-03'), standard, eventOf)).toBe(true)
    expect(ticketCovers(dayPass('2026-11-03'), otherDay, eventOf)).toBe(false)
    expect(ticketCovers(dayPass('2026-11-03'), panel, eventOf)).toBe(true)
    expect(ticketCovers(dayPass('2026-11-04'), panel, eventOf)).toBe(false)
    expect(ticketCovers(dayPass('2026-11-05'), mixer, eventOf)).toBe(false)
  })

  test('a single ticket: its own screening only', () => {
    expect(ticketCovers(single(standard.ref.id), standard, eventOf)).toBe(true)
    expect(ticketCovers(single(otherDay.ref.id), standard, eventOf)).toBe(false)
  })

  test('a gala ticket gets into its gala and the gala screening inside it', () => {
    const galaTicket = eventTicket('gala', 'evt_opening')
    expect(ticketCovers(galaTicket, opening, eventOf)).toBe(true)
    expect(ticketCovers(galaTicket, gala, eventOf)).toBe(true)
    expect(ticketCovers(galaTicket, standard, eventOf)).toBe(false)
    expect(ticketCovers(eventTicket('gala', 'evt_globe'), gala, eventOf)).toBe(false)
  })

  test('a masterclass ticket: its own session only', () => {
    expect(ticketCovers(eventTicket('masterclass', 'evt_mc_producing'), masterclass, eventOf)).toBe(true)
    expect(ticketCovers(eventTicket('masterclass', 'evt_mc_writing'), masterclass, eventOf)).toBe(false)
  })
})

describe('deciding a scan', () => {
  test('admits a good ticket while the doors are open', () => {
    expect(decide({ ticket: single(standard.ref.id), session: standard, now: during(standard) })).toBe('admitted')
    expect(decide({ ticket: festivalPass, session: standard, now: doorsOpenAt(standard) })).toBe('admitted')
  })

  test('says when the doors are not open yet, and when it is over', () => {
    expect(decide({ ticket: festivalPass, session: standard, now: new Date(doorsOpenAt(standard).getTime() - 1000) })).toBe('too_early')
    expect(decide({ ticket: festivalPass, session: standard, now: new Date(Date.parse(standard.endsAt) + 1000) })).toBe('ended')
  })

  test('knows an unknown, passed-on or void ticket', () => {
    const now = during(standard)
    expect(decide({ ticket: null, session: standard, now })).toBe('unknown')
    expect(decide({ ticket: ticket('screening', { screeningId: standard.ref.id }, 'transferred'), session: standard, now })).toBe('passed_on')
    expect(decide({ ticket: ticket('screening', { screeningId: standard.ref.id }, 'void'), session: standard, now })).toBe('void')
  })

  test('turns away a good ticket for somewhere else', () => {
    expect(decide({ ticket: single(otherDay.ref.id), session: standard, now: during(standard) })).toBe('wrong_session')
    expect(decide({ ticket: festivalPass, session: masterclass, now: during(masterclass) })).toBe('wrong_session')
  })

  test('lets nobody in twice: a check-in here, or a single ticket already used', () => {
    const now = during(standard)
    expect(decide({ ticket: festivalPass, session: standard, now, previous: { at: standard.startsAt } })).toBe('already_in')
    expect(decide({ ticket: ticket('screening', { screeningId: standard.ref.id }, 'used'), session: standard, now })).toBe('already_in')
  })

  test('passes fill only the seats single tickets did not reserve', () => {
    const now = during(standard)
    const free = standard.capacity - standard.reserved
    expect(decide({ ticket: festivalPass, session: standard, now, count: { admitted: free - 1, passAdmitted: free - 1 } })).toBe('admitted')
    expect(decide({ ticket: festivalPass, session: standard, now, count: { admitted: free, passAdmitted: free } })).toBe('full')
    // A single ticket's seat was held for it, however many passes are in.
    expect(decide({ ticket: single(standard.ref.id), session: standard, now, count: { admitted: free, passAdmitted: free } })).toBe('admitted')
  })

  test('events have no seat count, so passes are never turned away as full there', () => {
    expect(decide({ ticket: festivalPass, session: panel, now: during(panel), count: { admitted: 5000, passAdmitted: 5000 } })).toBe('admitted')
  })
})

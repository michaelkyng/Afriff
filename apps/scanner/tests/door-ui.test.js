import { describe, expect, test } from 'bun:test'
import { doorSessions } from '@afriff/api/door'
import * as seed from '@afriff/api/seed'
import { describeOutcome } from '../app/utils/outcomes.ts'
import { countLabel, defaultDay, groupSessions, sessionDays, sessionState } from '../app/utils/sessions.ts'

const sessions = doorSessions(seed)
const screening = sessions.find((item) => item.format === 'Standard')
const event = sessions.find((item) => item.eventKind === 'masterclass')
const ticket = { id: 't', code: 'AF-7KQ2-P4NR', holderName: 'Ada Okoye', productName: 'Single Screening', kind: 'screening', title: 'Salt Roads', subtitle: 'Tue 3 Nov, 18:30 · Landmark' }
const pass = { ...ticket, kind: 'festival_pass', productName: 'Festival Pass', title: 'Festival Pass', subtitle: undefined }
const result = (outcome, extra = {}) => ({ outcome, at: '2026-11-03T17:40:00Z', count: { admitted: 0, passAdmitted: 0 }, ...extra })

describe('the words on a result', () => {
  test('every outcome has a tone, a title, and holds the screen unless it lets someone in', () => {
    for (const outcome of ['admitted', 'already_in', 'wrong_session', 'passed_on', 'void', 'unknown', 'too_early', 'ended', 'full']) {
      const copy = describeOutcome(result(outcome, { ticket }), screening)
      expect(copy.title.length).toBeGreaterThan(3)
      expect(copy.hold).toBe(outcome !== 'admitted')
      expect(`${copy.title} ${copy.detail ?? ''}`).not.toMatch(/[–—]/)
    }
  })

  test('says when and by whom a ticket already came in', () => {
    const copy = describeOutcome(result('already_in', { ticket, previous: { at: '2026-11-03T17:12:00Z', byName: 'Door 2' } }), screening)
    expect(copy.detail).toBe('This ticket came in at 18:12, by Door 2.')
  })

  test('says what a wrong ticket is for, and what a pass does not cover', () => {
    expect(describeOutcome(result('wrong_session', { ticket }), screening).detail).toBe('It is for Salt Roads, Tue 3 Nov, 18:30 · Landmark.')
    expect(describeOutcome(result('wrong_session', { ticket: pass }), event)).toMatchObject({ title: 'Not for this event', detail: 'A Festival Pass does not cover it.' })
  })

  test('names a pass on the way in, and when the doors open', () => {
    expect(describeOutcome(result('admitted', { ticket: pass }), screening).detail).toBe('On a Festival Pass.')
    expect(describeOutcome(result('admitted', { ticket }), screening).detail).toBeUndefined()
    expect(describeOutcome(result('too_early'), screening).detail).toMatch(/^They open at \d{2}:\d{2}\.$/)
  })
})

describe('the session list', () => {
  test('a session is open from an hour before it starts until it ends', () => {
    const start = Date.parse(screening.startsAt)
    expect(sessionState(screening, new Date(start - 61 * 60_000))).toBe('upcoming')
    expect(sessionState(screening, new Date(start - 59 * 60_000))).toBe('open')
    expect(sessionState(screening, new Date(Date.parse(screening.endsAt) + 1))).toBe('ended')
  })

  test('starts on today during the festival, the first day before it, the last day after', () => {
    const days = sessionDays(sessions)
    expect(days).toEqual(seed.festival.days.map((day) => day.date))
    expect(defaultDay(days, new Date('2026-11-03T12:00:00+01:00'))).toBe('2026-11-03')
    expect(defaultDay(days, new Date('2026-10-14T12:00:00+01:00'))).toBe('2026-11-01')
    expect(defaultDay(days, new Date('2026-12-01T12:00:00+01:00'))).toBe('2026-11-07')
  })

  test('filters by day, venue and search, and splits by whether the doors are open', () => {
    const now = new Date('2026-11-03T18:20:00+01:00')
    const all = groupSessions(sessions, { day: '2026-11-03', venueIds: [], search: '', now })
    const total = all.open.length + all.upcoming.length + all.ended.length
    expect(total).toBe(sessions.filter((item) => item.startsAt.startsWith('2026-11-03')).length)
    expect(all.open.length).toBeGreaterThan(0)
    expect(all.open.every((item) => sessionState(item, now) === 'open')).toBe(true)

    const venue = all.open[0].venueId
    const one = groupSessions(sessions, { day: '2026-11-03', venueIds: [venue], search: '', now })
    expect([...one.open, ...one.upcoming, ...one.ended].every((item) => item.venueId === venue)).toBe(true)

    const found = groupSessions(sessions, { day: '2026-11-03', venueIds: [], search: all.open[0].title.slice(0, 5), now })
    expect(found.open.map((item) => item.ref.id)).toContain(all.open[0].ref.id)
  })

  test('counts against seats for a screening, and by heads for an event', () => {
    expect(countLabel({ admitted: 42, passAdmitted: 3 }, screening)).toBe(`42 / ${screening.capacity}`)
    expect(countLabel({ admitted: 42, passAdmitted: 3 }, event)).toBe('42 in')
  })
})

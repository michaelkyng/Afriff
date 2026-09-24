import { describe, expect, test } from 'bun:test'
import { createMockApi } from '@afriff/api/mock'
import {
  emptyRefs,
  mergeRefs,
  publishedUpdates,
  refsFromTickets,
  touches,
  unreadCount,
  updatesForAttendee,
  urgentForAttendee,
} from '@afriff/api/updates'

const api = createMockApi({ latency: 0 })

const update = (id, publishedAt, extra = {}) => ({
  id,
  kind: 'announcement',
  severity: 'normal',
  title: id,
  body: id,
  publishedAt,
  ...extra,
})

const UPDATES = [
  update('old_news', '2026-10-12T10:00:00+01:00'),
  update('venue_move', '2026-11-01T09:00:00+01:00', {
    kind: 'venue',
    severity: 'urgent',
    subject: { venueId: 'ven_landmark' },
  }),
  update('screening_qa', '2026-11-01T16:00:00+01:00', {
    kind: 'schedule',
    subject: { screeningId: 'scn_x' },
  }),
  update('later', '2026-11-05T10:00:00+01:00'),
]

const refs = (partial) => ({ ...emptyRefs(), ...partial })

describe('publishedUpdates', () => {
  test('shows what the clock says has happened, newest first', () => {
    const now = new Date('2026-11-01T18:00:00+01:00')
    expect(publishedUpdates(UPDATES, now).map((item) => item.id)).toEqual(['screening_qa', 'venue_move', 'old_news'])
  })

  test('before the festival there is only the early news', () => {
    expect(publishedUpdates(UPDATES, new Date('2026-10-20T10:00:00+01:00')).map((item) => item.id)).toEqual(['old_news'])
  })
})

describe('touches', () => {
  const mine = refs({ screeningIds: new Set(['scn_x']), venueIds: new Set(['ven_landmark']) })

  test('matches on any id the attendee is tied to', () => {
    expect(touches({ screeningId: 'scn_x' }, mine)).toBe(true)
    expect(touches({ venueId: 'ven_landmark' }, mine)).toBe(true)
    expect(touches({ screeningId: 'scn_other' }, mine)).toBe(false)
  })

  test('festival-wide news is nobody’s in particular', () => {
    expect(touches(undefined, mine)).toBe(false)
  })
})

describe('updatesForAttendee', () => {
  const now = new Date('2026-11-02T10:00:00+01:00')

  test('keeps only what names something of theirs', () => {
    const mine = refs({ screeningIds: new Set(['scn_x']) })
    expect(updatesForAttendee(UPDATES, mine, now).map((item) => item.id)).toEqual(['screening_qa'])
  })

  test('someone with nothing booked has nothing aimed at them', () => {
    expect(updatesForAttendee(UPDATES, emptyRefs(), now)).toEqual([])
  })
})

describe('urgentForAttendee', () => {
  const now = new Date('2026-11-02T10:00:00+01:00')
  const mine = refs({ venueIds: new Set(['ven_landmark']), screeningIds: new Set(['scn_x']) })

  test('only the urgent ones, and only while unread', () => {
    expect(urgentForAttendee(UPDATES, mine, [], now).map((item) => item.id)).toEqual(['venue_move'])
    expect(urgentForAttendee(UPDATES, mine, ['venue_move'], now)).toEqual([])
  })

  test('nothing urgent before it is published', () => {
    expect(urgentForAttendee(UPDATES, mine, [], new Date('2026-10-30T10:00:00+01:00'))).toEqual([])
  })
})

describe('unreadCount', () => {
  test('counts what is published and not yet read', () => {
    const now = new Date('2026-11-02T10:00:00+01:00')
    expect(unreadCount(UPDATES, [], now)).toBe(3)
    expect(unreadCount(UPDATES, ['old_news', 'venue_move'], now)).toBe(1)
    // Reading something that has not been published yet changes nothing.
    expect(unreadCount(UPDATES, ['later'], now)).toBe(3)
  })
})

describe('refsFromTickets and mergeRefs', () => {
  test('a ticket ties the attendee to its slot and its venue', () => {
    const tickets = [
      { id: 't1', status: 'valid', selection: { screeningId: 'scn_x' } },
      { id: 't2', status: 'valid', selection: { eventId: 'evt_y' } },
      { id: 't3', status: 'valid' },
      { id: 't4', status: 'transferred', selection: { screeningId: 'scn_gone' } },
    ]
    const result = refsFromTickets(tickets, (ticket) => (ticket.id === 't1' ? 'ven_landmark' : undefined))
    expect([...result.screeningIds]).toEqual(['scn_x'])
    expect([...result.eventIds]).toEqual(['evt_y'])
    expect([...result.venueIds]).toEqual(['ven_landmark'])
  })

  test('merges a plan and a pile of tickets into one set of ids', () => {
    const merged = mergeRefs(
      refs({ screeningIds: new Set(['a']) }),
      refs({ screeningIds: new Set(['b']), filmIds: new Set(['f']) }),
    )
    expect([...merged.screeningIds].sort()).toEqual(['a', 'b'])
    expect([...merged.filmIds]).toEqual(['f'])
  })
})

describe('updates.list', () => {
  test('is public and comes back newest first', async () => {
    const list = await api.updates.list()
    expect(list.length).toBeGreaterThan(5)
    const dates = list.map((item) => item.publishedAt)
    expect([...dates].sort((a, b) => b.localeCompare(a))).toEqual(dates)
    expect(list.every((item) => item.title && item.body && item.kind && item.severity)).toBe(true)
  })

  test('the seeded changes point at real screenings, events and venues', async () => {
    const [list, screenings, events, venues] = await Promise.all([
      api.updates.list(),
      api.programme.listScreenings(),
      api.programme.listEvents(),
      api.programme.listVenues(),
    ])
    for (const { subject } of list) {
      if (subject?.screeningId) expect(screenings.some((item) => item.id === subject.screeningId)).toBe(true)
      if (subject?.eventId) expect(events.some((item) => item.id === subject.eventId)).toBe(true)
      if (subject?.venueId) expect(venues.some((item) => item.id === subject.venueId)).toBe(true)
    }
  })

  test('at least one urgent change lands during the festival', async () => {
    const list = await api.updates.list()
    const urgent = list.filter((item) => item.severity === 'urgent')
    expect(urgent.length).toBeGreaterThan(0)
    expect(urgent.every((item) => item.subject)).toBe(true)
  })
})

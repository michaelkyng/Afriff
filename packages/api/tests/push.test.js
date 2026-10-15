import { describe, expect, test } from 'bun:test'
import { deviceSchema } from '@afriff/validation'
import {
  audienceOf,
  kindForUpdate,
  PUSH_FRESH_MS,
  reminderPush,
  reminderTtlSeconds,
  reminderWindow,
  shouldPushUpdate,
  ticketTiesHolder,
  updatePush,
} from '@afriff/api/push'

const now = new Date('2026-11-03T17:00:00Z')
const minutesFrom = (minutes) => new Date(now.getTime() + minutes * 60_000).toISOString()

describe('which updates are pushed', () => {
  test('an urgent update goes out once it is published, while it is news', () => {
    expect(shouldPushUpdate({ severity: 'urgent', publishedAt: minutesFrom(0) }, now)).toBe(true)
    expect(shouldPushUpdate({ severity: 'urgent', publishedAt: minutesFrom(-29) }, now)).toBe(true)
  })

  test('nothing that is not urgent interrupts anyone', () => {
    expect(shouldPushUpdate({ severity: 'info', publishedAt: minutesFrom(0) }, now)).toBe(false)
  })

  test('a scheduled update waits for its time, and old news is never pushed (a reseed, a late deploy)', () => {
    expect(shouldPushUpdate({ severity: 'urgent', publishedAt: minutesFrom(5) }, now)).toBe(false)
    expect(shouldPushUpdate({ severity: 'urgent', publishedAt: new Date(now.getTime() - PUSH_FRESH_MS - 1).toISOString() }, now)).toBe(false)
  })

  test('works with the programme’s Lagos times as well as UTC', () => {
    expect(shouldPushUpdate({ severity: 'urgent', publishedAt: '2026-11-03T17:50:00+01:00' }, now)).toBe(true)
  })
})

describe('who an update is pushed to', () => {
  test('an update about something goes to the people it touches, as a change', () => {
    const update = { subject: { screeningId: 'scn_1' } }
    expect(audienceOf(update)).toBe('affected')
    expect(kindForUpdate(update)).toBe('changes')
  })

  test('one about nothing in particular goes to everyone who wants festival news', () => {
    for (const subject of [undefined, {}, { screeningId: undefined }]) {
      expect(audienceOf({ subject })).toBe('everyone')
      expect(kindForUpdate({ subject })).toBe('festival')
    }
  })

  test('a ticket ties its holder while the slot is still to come; a cancelled one still counts', () => {
    expect(ticketTiesHolder({ status: 'valid', startsAt: minutesFrom(60), endsAt: minutesFrom(150) }, now)).toBe(true)
    expect(ticketTiesHolder({ status: 'void', startsAt: minutesFrom(60), endsAt: minutesFrom(150) }, now)).toBe(true)
    expect(ticketTiesHolder({ status: 'valid', startsAt: minutesFrom(-60), endsAt: minutesFrom(30) }, now)).toBe(true)
  })

  test('not once it is over, passed on or used; a pass has no time and always counts', () => {
    expect(ticketTiesHolder({ status: 'valid', startsAt: minutesFrom(-180), endsAt: minutesFrom(-60) }, now)).toBe(false)
    expect(ticketTiesHolder({ status: 'transferred', startsAt: minutesFrom(60) }, now)).toBe(false)
    expect(ticketTiesHolder({ status: 'used', startsAt: minutesFrom(60) }, now)).toBe(false)
    expect(ticketTiesHolder({ status: 'valid' }, now)).toBe(true)
  })
})

describe('what a push says', () => {
  test('an update opens its link, or the updates list, and replaces an earlier copy of itself', () => {
    const push = updatePush({ id: 'upd_1', title: 'Venue change', body: 'Now at Terra Kulture.', link: '/screenings/scn_1' })
    expect(push).toEqual({ title: 'Venue change', body: 'Now at Terra Kulture.', url: '/screenings/scn_1', tag: 'update:upd_1' })
    expect(updatePush({ id: 'upd_2', title: 'x', body: 'y' }).url).toBe('/updates')
  })

  test('long text is clipped to fit a notification', () => {
    const push = updatePush({ id: 'upd_1', title: 'T'.repeat(200), body: 'B '.repeat(200) })
    expect(push.title.length).toBe(80)
    expect(push.title.endsWith('…')).toBe(true)
    expect(push.body.length).toBeLessThanOrEqual(180)
  })

  test('a reminder says when and where, in Lagos time, and opens My festival', () => {
    expect(reminderPush({ key: 'screening:scn_1', title: 'Salt Roads', startsAt: '2026-11-03T18:30:00+01:00', place: 'Landmark' })).toEqual({
      title: 'Salt Roads',
      body: 'Starts at 18:30 · Landmark',
      url: '/my-festival',
      tag: 'reminder:screening:scn_1',
    })
  })
})

describe('when reminders go', () => {
  test('each run covers slots 25 to 35 minutes away, so every slot falls in two runs', () => {
    const { from, to } = reminderWindow(now)
    expect(from.toISOString()).toBe(minutesFrom(25))
    expect(to.toISOString()).toBe(minutesFrom(35))
  })

  test('a reminder is worth delivering until the slot starts', () => {
    expect(reminderTtlSeconds(minutesFrom(30), now)).toBe(1800)
    expect(reminderTtlSeconds(minutesFrom(-5), now)).toBe(60)
  })
})

describe('a device signing up', () => {
  const device = {
    deviceId: 'd7c1d1b2-4a8e-4f8e-9a51-6c1e3c2f9b10',
    token: 'f'.repeat(160),
    kinds: { changes: true, reminders: false, festival: true },
    reminders: ['screening:scn_1'],
  }

  test('a device with a token and its settings is accepted', () => {
    expect(deviceSchema.safeParse(device).success).toBe(true)
  })

  test('an id that could escape its path, or a missing setting, is refused', () => {
    expect(deviceSchema.safeParse({ ...device, deviceId: '../users' }).success).toBe(false)
    expect(deviceSchema.safeParse({ ...device, kinds: { changes: true } }).success).toBe(false)
    expect(deviceSchema.safeParse({ ...device, token: 'short' }).success).toBe(false)
  })
})

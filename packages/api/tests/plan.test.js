import { describe, expect, test } from 'bun:test'
import { createMockApi } from '@afriff/api/mock'
import { buildPlan, groupPlanByDay, overlaps, planWarnings, warningsByKey } from '@afriff/api/plan'

const PIN = '481902'
const ANY_CODE = '314159'
const CARD = { method: 'card', cardName: 'Ada Okoye', cardNumber: '4111 1111 1111 1234', expiry: '11/29', cvv: '123' }
const CONTACT = { name: 'Ada Okoye', email: 'ada@example.com', phone: '0803 123 4567' }

async function signedIn(email = 'ada@example.com') {
  const api = createMockApi({ latency: 0 })
  await api.auth.requestCode({ email, purpose: 'signup' })
  const ticket = await api.auth.verifyCode({ email, code: ANY_CODE })
  await api.auth.setPin({ ticket: ticket.token, pin: PIN, name: 'Ada Okoye' })
  return api
}

// ------------------------------------------------------------------ the API

describe('saved', () => {
  test('saves films, screenings and events, newest first, without duplicates', async () => {
    const api = await signedIn()
    const [film] = await api.programme.listFilms()
    const [screening] = await api.programme.listScreenings()

    let items = await api.saved.add({ kind: 'film', refId: film.id })
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ kind: 'film', refId: film.id })
    expect(items[0].savedAt).toBeTruthy()

    items = await api.saved.add({ kind: 'screening', refId: screening.id })
    expect(items).toHaveLength(2)
    expect(items[0].refId).toBe(screening.id)

    items = await api.saved.add({ kind: 'film', refId: film.id })
    expect(items).toHaveLength(2)

    items = await api.saved.remove({ kind: 'film', refId: film.id })
    expect(items).toHaveLength(1)
    expect(items[0].kind).toBe('screening')
  })

  test('refuses something the programme does not have', async () => {
    const api = await signedIn()
    await expect(api.saved.add({ kind: 'film', refId: 'film_nope' })).rejects.toMatchObject({ code: 'not_found' })
  })

  test('needs a signed-in attendee, and keeps lists apart', async () => {
    const api = await signedIn()
    const [film] = await api.programme.listFilms()
    await api.saved.add({ kind: 'film', refId: film.id })

    await api.auth.signOut()
    await expect(api.saved.list()).rejects.toMatchObject({ code: 'unauthorized' })

    await api.auth.requestCode({ email: 'bem@example.com', purpose: 'signup' })
    const ticket = await api.auth.verifyCode({ email: 'bem@example.com', code: ANY_CODE })
    await api.auth.setPin({ ticket: ticket.token, pin: PIN, name: 'Bem Tersoo' })
    expect(await api.saved.list()).toHaveLength(0)
  })

  test('merge folds a device list in and drops what has gone', async () => {
    const api = await signedIn()
    const films = await api.programme.listFilms()
    await api.saved.add({ kind: 'film', refId: films[0].id })

    const merged = await api.saved.merge([
      { kind: 'film', refId: films[0].id },
      { kind: 'film', refId: films[1].id },
      { kind: 'film', refId: 'film_gone' },
    ])
    expect(merged).toHaveLength(2)
    expect(merged.map((item) => item.refId).sort()).toEqual([films[0].id, films[1].id].sort())
  })
})

// ------------------------------------------------------------------ the plan

const venue = (id) => ({ id, slug: id, name: id, shortName: id, area: '', address: '', mapsUrl: '', screens: [], accessibility: [] })

/** A stand-in programme item: only the fields the plan actually reads. */
function slot(id, startsAt, endsAt, venueId = 'ven_landmark', kind = 'screening') {
  return { kind, id, title: id, startsAt, endsAt, venue: venue(venueId), room: 'Cinema 1' }
}

const at = (hhmm) => `2026-11-03T${hhmm}:00+01:00`

describe('buildPlan', () => {
  const timeline = [
    slot('scn_a', at('10:00'), at('11:40')),
    slot('scn_b', at('12:00'), at('13:30')),
    slot('evt_c', at('18:00'), at('20:00'), 'ven_terra', 'event'),
  ]

  test('merges tickets and saved items into one slot each, tickets winning', () => {
    const tickets = [{ id: 'tkt_1', status: 'valid', selection: { screeningId: 'scn_a' } }]
    const saved = [
      { kind: 'screening', refId: 'scn_a', savedAt: at('09:00') },
      { kind: 'screening', refId: 'scn_b', savedAt: at('09:00') },
      { kind: 'film', refId: 'film_x', savedAt: at('09:00') },
    ]
    const plan = buildPlan(timeline, tickets, saved)

    expect(plan).toHaveLength(2)
    expect(plan[0]).toMatchObject({ key: 'screening:scn_a', source: 'ticket' })
    expect(plan[0].ticket.id).toBe('tkt_1')
    expect(plan[1]).toMatchObject({ key: 'screening:scn_b', source: 'saved' })
    // A saved film is for the watchlist, not the schedule.
    expect(plan.some((entry) => entry.key.includes('film_x'))).toBe(false)
  })

  test('leaves out spent tickets, passes and anything off the programme', () => {
    const tickets = [
      { id: 'tkt_used', status: 'used', selection: { screeningId: 'scn_a' } },
      { id: 'tkt_pass', status: 'valid' },
      { id: 'tkt_gone', status: 'valid', selection: { screeningId: 'scn_zzz' } },
    ]
    expect(buildPlan(timeline, tickets, [])).toHaveLength(0)
  })

  test('puts events on the plan too', () => {
    const plan = buildPlan(timeline, [{ id: 'tkt_2', status: 'valid', selection: { eventId: 'evt_c' } }], [])
    expect(plan[0]).toMatchObject({ key: 'event:evt_c', kind: 'event', source: 'ticket' })
  })

  test('groups by the Lagos day, in order', () => {
    const late = slot('scn_late', '2026-11-03T23:30:00+01:00', '2026-11-04T01:00:00+01:00')
    const plan = buildPlan(
      [...timeline, late],
      [],
      [
        { kind: 'screening', refId: 'scn_late', savedAt: at('09:00') },
        { kind: 'screening', refId: 'scn_a', savedAt: at('09:00') },
      ],
    )
    const days = groupPlanByDay(plan)
    expect(days.map((day) => day.date)).toEqual(['2026-11-03'])
    expect(days[0].entries.map((entry) => entry.key)).toEqual(['screening:scn_a', 'screening:scn_late'])
  })
})

describe('planWarnings', () => {
  const saved = (...ids) => ids.map((id) => ({ kind: 'screening', refId: id, savedAt: at('09:00') }))

  test('finds two things booked over each other', () => {
    const timeline = [slot('scn_a', at('10:00'), at('11:40')), slot('scn_b', at('11:00'), at('12:30'))]
    const warnings = planWarnings(buildPlan(timeline, [], saved('scn_a', 'scn_b')))
    expect(warnings).toHaveLength(1)
    expect(warnings[0].kind).toBe('clash')
    expect([warnings[0].a.key, warnings[0].b.key]).toEqual(['screening:scn_a', 'screening:scn_b'])
    expect(warningsByKey(warnings)).toEqual(new Map([['screening:scn_a', 'clash'], ['screening:scn_b', 'clash']]))
  })

  test('back to back at the same venue is fine', () => {
    const timeline = [slot('scn_a', at('10:00'), at('11:40')), slot('scn_b', at('11:40'), at('13:00'))]
    expect(planWarnings(buildPlan(timeline, [], saved('scn_a', 'scn_b')))).toEqual([])
  })

  test('warns when the next one is across town with no time to get there', () => {
    const timeline = [
      slot('scn_a', at('10:00'), at('11:40'), 'ven_landmark'),
      slot('scn_b', at('12:00'), at('13:00'), 'ven_terra'),
    ]
    const warnings = planWarnings(buildPlan(timeline, [], saved('scn_a', 'scn_b')))
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toMatchObject({ kind: 'tight', gapMinutes: 20 })
    expect([...warningsByKey(warnings).values()]).toEqual(['tight', 'tight'])
  })

  test('an hour between venues is enough', () => {
    const timeline = [
      slot('scn_a', at('10:00'), at('11:40'), 'ven_landmark'),
      slot('scn_b', at('12:45'), at('14:00'), 'ven_terra'),
    ]
    expect(planWarnings(buildPlan(timeline, [], saved('scn_a', 'scn_b')))).toEqual([])
  })

  test('reports one long slot against everything it swallows', () => {
    const timeline = [
      slot('scn_long', at('10:00'), at('16:00')),
      slot('scn_b', at('11:00'), at('12:00')),
      slot('scn_c', at('13:00'), at('14:00')),
    ]
    const warnings = planWarnings(buildPlan(timeline, [], saved('scn_long', 'scn_b', 'scn_c')))
    expect(warnings.filter((warning) => warning.kind === 'clash')).toHaveLength(2)
  })
})

describe('overlaps', () => {
  test('is true only when the two actually run over each other', () => {
    const a = { startsAt: at('10:00'), endsAt: at('11:00') }
    expect(overlaps(a, { startsAt: at('10:59'), endsAt: at('12:00') })).toBe(true)
    expect(overlaps(a, { startsAt: at('11:00'), endsAt: at('12:00') })).toBe(false)
    expect(overlaps(a, { startsAt: at('09:00'), endsAt: at('10:00') })).toBe(false)
  })
})

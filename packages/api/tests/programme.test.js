import { describe, expect, test } from 'bun:test'
import { formatMoney, formatTime, lagosDateKey } from '@afriff/api/format'
import { availabilityOf, buildLookups, buildTimeline } from '@afriff/api/programme'
import { EMPTY_FILTERS, filmMatches, timeOfDay } from '@afriff/api/filters'

describe('shared domain without Nuxt auto-imports', () => {
  test('formats kobo and uses Lagos dates across a UTC day boundary', () => {
    expect(formatMoney({ amount: 7500000, currency: 'NGN' })).toContain('75,000')
    expect(formatTime('2026-11-01T23:30:00Z')).toBe('00:30')
    expect(lagosDateKey('2026-11-01T23:30:00Z')).toBe('2026-11-02')
    expect(timeOfDay('2026-11-01T16:00:00Z')).toBe('evening')
  })

  test('keeps availability thresholds and oversold inventory consistent', () => {
    expect(availabilityOf({ capacity: 100, sold: 87 }).status).toBe('available')
    expect(availabilityOf({ capacity: 100, sold: 88 }).status).toBe('selling_fast')
    expect(availabilityOf({ capacity: 100, sold: 110 })).toEqual({ status: 'sold_out', seatsLeft: 0 })
  })

  test('joins screenings to their films and venues and skips broken references', () => {
    const data = {
      films: [{ id: 'film', title: 'Àṣẹ', sectionId: 'section' }],
      sections: [{ id: 'section' }],
      venues: [{ id: 'venue', screens: [{ id: 'screen', name: 'Main' }] }],
      screenings: [
        { id: 'valid', filmId: 'film', screenId: 'screen', startsAt: '2026-11-01T18:00:00+01:00', capacity: 100, sold: 10 },
        { id: 'missing', filmId: 'unknown', screenId: 'screen' },
      ],
      events: [], products: [],
    }
    const timeline = buildTimeline(data, buildLookups(data))
    expect(timeline).toHaveLength(1)
    expect(timeline[0]).toMatchObject({ id: 'valid', title: 'Àṣẹ', room: 'Main', availability: { seatsLeft: 90 } })
  })

  test('matches accented titles and combines search with genre filters', () => {
    const film = { title: 'Àṣẹ', director: 'Ada', cast: [], countries: ['Nigeria'], languages: ['Yoruba'], genres: ['Drama'] }
    expect(filmMatches(film, { ...EMPTY_FILTERS, q: 'ase nigeria', genres: ['Drama'] })).toBe(true)
    expect(filmMatches(film, { ...EMPTY_FILTERS, q: 'ase', genres: ['Comedy'] })).toBe(false)
  })
})

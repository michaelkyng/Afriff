import { describe, expect, test } from 'bun:test'
import { ApiError, isApiError } from '@afriff/api'
import { createMockApi } from '@afriff/api/mock'
import { buildLookups, buildTimeline } from '@afriff/api/programme'

describe('mock API through workspace exports', () => {
  const api = createMockApi({ latency: 0 })

  test('reports invalid input through the shared API error contract', async () => {
    await expect(api.programme.listFilms({ genre: 'Unknown' }))
      .rejects.toMatchObject({ name: 'ApiError', code: 'validation' })
    await expect(api.programme.listScreenings({ date: '2026-02-30' }))
      .rejects.toMatchObject({ name: 'ApiError', code: 'validation' })
  })

  test('returns isolated data so callers cannot mutate fixtures', async () => {
    const films = await api.programme.listFilms()
    const originalTitle = films[0].title
    films[0].title = 'Changed by a consumer'
    expect((await api.programme.getFilm(films[0].slug)).title).toBe(originalTitle)
  })

  test('shares the same error class as the contract entry point', async () => {
    try {
      await api.programme.getFilm('does-not-exist')
      throw new Error('Expected the API to reject an unknown film')
    }
    catch (error) {
      expect(error).toBeInstanceOf(ApiError)
      expect(isApiError(error)).toBe(true)
      expect(error.code).toBe('not_found')
    }
  })

  test('all mock screenings and events join into the shared programme timeline', async () => {
    const [films, venues, sections, screenings, events, products] = await Promise.all([
      api.programme.listFilms(), api.programme.listVenues(), api.programme.listSections(),
      api.programme.listScreenings(), api.programme.listEvents(), api.catalog.listProducts(),
    ])
    const data = { films, venues, sections, screenings, events, products }
    const timeline = buildTimeline(data, buildLookups(data))
    expect(screenings.length).toBeGreaterThan(0)
    expect(events.length).toBeGreaterThan(0)
    expect(timeline).toHaveLength(screenings.length + events.length)
    expect(timeline.map((item) => item.startsAt)).toEqual(timeline.map((item) => item.startsAt).sort())
    const filmId = screenings[0].filmId
    expect((await api.programme.listScreenings({ filmId })).every((screening) => screening.filmId === filmId)).toBe(true)
  })
})

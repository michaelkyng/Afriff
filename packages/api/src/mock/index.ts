import { filmQuerySchema, screeningQuerySchema } from '@afriff/validation'
import type { AttendeeApi } from '../contract'
import { ApiError } from '../contract'
import type { FilmQuery, ScreeningQuery } from '../types'
import { createMockAuth } from './auth'
import { createMockOrders } from './orders'
import * as seed from './seed'

export interface MockApiOptions {
  /** Average simulated latency in ms. Each call jitters ±40% around it. */
  latency: number
}

/** Deep-copy so callers can never mutate the seed through a returned object. */
function clone<T>(value: T): T {
  return structuredClone(value)
}

function normalise(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

export function createMockApi(options: MockApiOptions): AttendeeApi {
  /** Producers may be async: hashing a PIN is, everything else is not. */
  const respond = async <T>(produce: () => T | Promise<T>): Promise<T> => {
    if (options.latency > 0) {
      const jitter = options.latency * (0.6 + Math.random() * 0.8)
      await new Promise((resolve) => setTimeout(resolve, jitter))
    }
    return clone(await produce())
  }

  const auth = createMockAuth(respond)
  const shop = createMockOrders(respond, auth.currentUser)

  return {
    setAuthToken: auth.setToken,

    auth: auth.api,

    festival: {
      get: () => respond(() => seed.festival),
    },

    programme: {
      listVenues: () => respond(() => seed.venues),

      listSections: () => respond(() => seed.sections),

      listFilms: (query: FilmQuery = {}) =>
        respond(() => {
          const parsed = filmQuerySchema.safeParse(query)
          if (!parsed.success) throw new ApiError('validation', 'Invalid film query.', { issues: parsed.error.issues })
          const term = query.search ? normalise(query.search.trim()) : ''
          return seed.films.filter((film) => {
            if (query.sectionId && film.sectionId !== query.sectionId) return false
            if (query.genre && !film.genres.includes(query.genre)) return false
            if (query.featured !== undefined && Boolean(film.featured) !== query.featured) return false
            if (term) {
              const haystack = normalise([film.title, film.director, ...film.cast, ...film.countries].join(' '))
              if (!haystack.includes(term)) return false
            }
            return true
          })
        }),

      getFilm: (slug: string) =>
        respond(() => {
          const film = seed.films.find((f) => f.slug === slug)
          if (!film) throw new ApiError('not_found', `No film found for “${slug}”.`, { slug })
          return film
        }),

      listScreenings: (query: ScreeningQuery = {}) =>
        respond(() => {
          const parsed = screeningQuerySchema.safeParse(query)
          if (!parsed.success) throw new ApiError('validation', 'Invalid screening query.', { issues: parsed.error.issues })
          return seed.screenings.filter((screening) => {
            if (query.date && !screening.startsAt.startsWith(query.date)) return false
            if (query.venueId && screening.venueId !== query.venueId) return false
            if (query.filmId && screening.filmId !== query.filmId) return false
            return true
          })
        }),

      listEvents: () => respond(() => seed.events),
    },

    catalog: {
      listProducts: () => respond(() => shop.products()),
    },

    orders: shop.orders,

    tickets: shop.tickets,
  }
}

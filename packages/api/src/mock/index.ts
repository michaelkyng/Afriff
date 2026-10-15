import { deviceSchema } from '@afriff/validation'
import type { AttendeeApi } from '../contract'
import { ApiError, validationError } from '../contract'
import { selectFilms, selectScreenings } from '../queries'
import type { DeviceInput, FilmQuery, ScreeningQuery } from '../types'
import { createMockAuth } from './auth'
import { createMockOrders } from './orders'
import { createMockPayments } from './payments'
import type { MockGateway } from './payments'
import { createMockSaved } from './saved'
import * as seed from './seed'

export type { MockGateway, MockPaymentOutcome } from './payments'

export interface MockApiOptions {
  /** Average simulated latency in ms. Each call jitters ±40% around it. */
  latency: number
}

/**
 * The attendee API, plus the stand-in payment checkout the app shows in place of
 * Paystack's. `gateway` is not part of the contract: only the mock has it.
 */
export interface MockApi extends AttendeeApi {
  gateway: MockGateway
}

/** Deep-copy so callers can never mutate the seed through a returned object. */
function clone<T>(value: T): T {
  return structuredClone(value)
}

export function createMockApi(options: MockApiOptions): MockApi {
  /** Producers may be async: hashing is, everything else is not. */
  const respond = async <T>(produce: () => T | Promise<T>): Promise<T> => {
    if (options.latency > 0) {
      const jitter = options.latency * (0.6 + Math.random() * 0.8)
      await new Promise((resolve) => setTimeout(resolve, jitter))
    }
    return clone(await produce())
  }

  const auth = createMockAuth(respond)
  const payments = createMockPayments()
  const shop = createMockOrders(respond, auth.currentUser, payments)
  const saved = createMockSaved(respond, auth.currentUser)

  return {
    gateway: payments.gateway,

    auth: auth.api,

    festival: {
      get: () => respond(() => seed.festival),
    },

    programme: {
      listVenues: () => respond(() => seed.venues),

      listSections: () => respond(() => seed.sections),

      listFilms: (query: FilmQuery = {}) => respond(() => selectFilms(seed.films, query)),

      getFilm: (slug: string) =>
        respond(() => {
          const film = seed.films.find((f) => f.slug === slug)
          if (!film) throw new ApiError('not_found', `No film found for “${slug}”.`, { slug })
          return film
        }),

      listScreenings: (query: ScreeningQuery = {}) => respond(() => selectScreenings(seed.screenings, query)),

      listEvents: () => respond(() => seed.events),
    },

    info: {
      get: () => respond(() => ({ faqs: seed.faqs, policies: seed.policies, contact: seed.contact })),
    },

    updates: {
      list: () =>
        respond(() =>
          [...seed.updates].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)),
        ),
    },

    catalog: {
      listProducts: () => respond(() => shop.products()),
    },

    orders: shop.orders,

    tickets: shop.tickets,

    // There is no push service in the demo, so the app never gets a token to save. Kept so the contract is whole.
    notifications: {
      saveDevice: (input: DeviceInput) =>
        respond(() => {
          auth.currentUser()
          const parsed = deviceSchema.safeParse(input)
          if (!parsed.success) throw validationError(parsed.error.issues, 'We could not save this device.')
        }),
      removeDevice: () => respond(() => void auth.currentUser()),
    },

    saved,
  }
}

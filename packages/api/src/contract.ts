import type {
  Festival,
  FestivalEvent,
  Film,
  FilmQuery,
  Screening,
  ScreeningQuery,
  Section,
  TicketProduct,
  Venue,
} from './types'

/**
 * The attendee API contract.
 *
 * Pages and stores only ever talk to this interface (via `useApi()`).
 * Today it is implemented by the mock adapter in `./mock`. When the backend
 * exists, an `http` adapter implements the same interface and the app switches
 * with `NUXT_PUBLIC_API_MODE=http` — no page or component changes.
 *
 * New areas (auth, orders, tickets, inbox) are added here as their features land.
 */
export interface AttendeeApi {
  festival: {
    get(): Promise<Festival>
  }
  programme: {
    listVenues(): Promise<Venue[]>
    listSections(): Promise<Section[]>
    listFilms(query?: FilmQuery): Promise<Film[]>
    /** Throws `ApiError('not_found')` when the slug does not exist. */
    getFilm(slug: string): Promise<Film>
    listScreenings(query?: ScreeningQuery): Promise<Screening[]>
    listEvents(): Promise<FestivalEvent[]>
  }
  catalog: {
    listProducts(): Promise<TicketProduct[]>
  }
}

export type ApiErrorCode =
  | 'not_found'
  | 'network'
  | 'validation'
  | 'unauthorized'
  | 'conflict'
  | 'sold_out'
  | 'unknown'

export class ApiError extends Error {
  readonly code: ApiErrorCode
  readonly details?: Record<string, unknown>

  constructor(code: ApiErrorCode, message: string, details?: Record<string, unknown>) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.details = details
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}

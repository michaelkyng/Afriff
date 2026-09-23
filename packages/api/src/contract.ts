import type {
  AuthSession,
  CodeChallenge,
  Festival,
  FestivalEvent,
  Film,
  FilmQuery,
  ProfileInput,
  RequestCodeInput,
  Screening,
  ScreeningQuery,
  Section,
  SetPinInput,
  SignInInput,
  TicketProduct,
  User,
  Venue,
  VerificationTicket,
  VerifyCodeInput,
} from './types'

/**
 * The attendee API contract.
 *
 * Pages and stores only ever talk to this interface (via `useApi()`).
 * Today it is implemented by the mock adapter in `./mock`. When the backend
 * exists, an `http` adapter implements the same interface and the app switches
 * with `NUXT_PUBLIC_API_MODE=http` — no page or component changes.
 *
 * New areas (orders, tickets, inbox) are added here as their features land.
 */
export interface AttendeeApi {
  /**
   * The session token to send with authenticated calls, or null when signed out.
   * The app sets this from the persisted session on start-up and after sign-in.
   */
  setAuthToken(token: string | null): void

  /**
   * Signing in takes an email and a six-digit PIN. Getting a PIN in the first
   * place — signing up, or replacing a forgotten one — goes through an emailed
   * code: `requestCode` → `verifyCode` → `setPin`.
   */
  auth: {
    /**
     * Signs an existing account in.
     * Throws `ApiError('unauthorized')` when the pair does not match, or when
     * too many wrong PINs have locked the account for a while.
     */
    signIn(input: SignInInput): Promise<AuthSession>
    /**
     * Sends a one-time code to the email, to sign up or to reset a PIN.
     * In mock mode the returned challenge carries the code to show on screen.
     * Throws `ApiError('conflict')` signing up with an email that already has an
     * account, and `ApiError('not_found')` resetting one that has none.
     */
    requestCode(input: RequestCodeInput): Promise<CodeChallenge>
    /**
     * Checks the code and returns a short-lived ticket for `setPin`.
     * Throws `ApiError('unauthorized')` when the code is wrong or expired.
     */
    verifyCode(input: VerifyCodeInput): Promise<VerificationTicket>
    /**
     * Sets the PIN against a verified email and signs in with it. A sign-up also
     * needs `name`; a reset ends the account's other sessions.
     * Throws `ApiError('unauthorized')` when the ticket is spent or expired.
     */
    setPin(input: SetPinInput): Promise<AuthSession>
    /** The signed-in attendee. Throws `ApiError('unauthorized')` without a valid token. */
    me(): Promise<User>
    updateProfile(input: ProfileInput): Promise<User>
    signOut(): Promise<void>
  }

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

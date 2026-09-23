import type {
  AuthSession,
  CodeChallenge,
  Festival,
  FestivalEvent,
  Film,
  FilmQuery,
  CheckoutInput,
  Order,
  PaymentInput,
  ProfileInput,
  RequestCodeInput,
  SavedInput,
  SavedItem,
  Screening,
  ScreeningQuery,
  Section,
  SetPinInput,
  SignInInput,
  Ticket,
  TicketProduct,
  TicketTransferInput,
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
    /** Stock already sold through this API is taken off `remaining`. */
    listProducts(): Promise<TicketProduct[]>
  }

  /** Buying. Every call needs a signed-in attendee. */
  orders: {
    /**
     * Places an order and takes payment in one step, the way a hosted checkout does.
     * Throws `ApiError('validation')` for a bad selection, `ApiError('sold_out')`
     * when stock ran out, and `ApiError('unauthorized')` without a session.
     */
    checkout(input: CheckoutInput): Promise<Order>
    list(): Promise<Order[]>
    /** Throws `ApiError('not_found')` for an order that is not the attendee's. */
    get(id: string): Promise<Order>
    /** Tries payment again on a failed order. */
    pay(orderId: string, payment: PaymentInput): Promise<Order>
    /** Stands in for the bank telling us a transfer landed. */
    confirmTransfer(orderId: string): Promise<Order>
  }

  tickets: {
    /**
     * Every admission the attendee holds, earliest first. Shown under My tickets.
     * Anything transferred to their email before they had an account arrives here
     * the first time they ask.
     */
    list(): Promise<Ticket[]>
    /** Throws `ApiError('not_found')` for a ticket that is not the attendee's. */
    get(id: string): Promise<Ticket>
    /**
     * Passes a ticket on. The sender keeps a record of where it went; the
     * recipient gets a new ticket with its own code, waiting for them if they do
     * not have an account yet.
     * Throws `ApiError('conflict')` for a ticket that has been used, passed on
     * already, or whose screening has started.
     */
    transfer(id: string, input: TicketTransferInput): Promise<Ticket>
  }

  /**
   * What the attendee has put aside: films to watch out for, and the screenings
   * and events they mean to be at. Every call returns the whole list, because it
   * is short and the app keeps a copy on the device.
   */
  saved: {
    list(): Promise<SavedItem[]>
    /** Adding something already saved is not an error; the list comes back unchanged. */
    add(input: SavedInput): Promise<SavedItem[]>
    remove(input: SavedInput): Promise<SavedItem[]>
    /** Takes what a device saved before signing in and folds it into the account. */
    merge(inputs: SavedInput[]): Promise<SavedItem[]>
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

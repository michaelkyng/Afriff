import type {
  CheckoutInput,
  DeviceInput,
  EmailVerificationChallenge,
  Festival,
  FestivalEvent,
  FestivalInfo,
  FestivalUpdate,
  Film,
  FilmQuery,
  Order,
  PasswordResetChallenge,
  PasswordResetInput,
  PasswordResetRequestInput,
  PaymentIntent,
  ProfileInput,
  SavedInput,
  SavedItem,
  Screening,
  ScreeningQuery,
  Section,
  SignInInput,
  SignUpInput,
  Ticket,
  TicketProduct,
  TicketTransferInput,
  User,
  Venue,
} from './types'

/**
 * The attendee API contract.
 *
 * Pages and stores only ever talk to this interface (via `useApi()`). Two
 * adapters implement it: `./mock`, which runs entirely in the browser, and
 * `./firebase`, backed by Firebase Auth, Firestore and Cloud Functions. The app
 * picks one with `NUXT_PUBLIC_API_MODE` — no page or component changes.
 */
export interface AttendeeApi {
  /**
   * Accounts are an email and a password. The adapter owns the credentials and
   * keeps the session itself (Firebase refreshes its tokens on its own), so the
   * app never handles a token: it asks `restore()` who is signed in on start-up
   * and listens to `onSessionChange` for anything that happens behind its back.
   */
  auth: {
    /**
     * The account this device is already signed in to, or null. Call once on
     * start-up, before anything that needs an account.
     * Throws `ApiError('network')` when there is a session but the account could
     * not be loaded, so the caller can keep what it last knew rather than sign out.
     */
    restore(): Promise<User | null>
    /**
     * Called when the session changes without this app asking: signed out in
     * another tab, or the session revoked after a password reset elsewhere.
     * Returns a function that stops listening.
     */
    onSessionChange(listener: (user: User | null) => void): () => void
    /**
     * Throws `ApiError('unauthorized')` when the pair does not match — with the
     * same message whether or not the email has an account — and
     * `ApiError('rate_limited')` after too many wrong passwords.
     */
    signIn(input: SignInInput): Promise<User>
    /**
     * Creates the account, signs it in and sends a link to confirm the email.
     * Throws `ApiError('conflict')` when the email already has an account.
     */
    signUp(input: SignUpInput): Promise<User>
    /** Emails a reset link. Answers the same way whether or not the email has an account. */
    requestPasswordReset(input: PasswordResetRequestInput): Promise<PasswordResetChallenge>
    /**
     * Checks the code from a reset link before asking for a new password, and
     * says whose account it is for. Throws `ApiError('unauthorized')` when the
     * link has expired or been used.
     */
    checkPasswordReset(code: string): Promise<{ email: string }>
    /**
     * Sets the new password and signs in with it. Every other session on the
     * account ends. Throws `ApiError('unauthorized')` for a spent or expired link.
     */
    resetPassword(input: PasswordResetInput): Promise<User>
    /** Emails a fresh confirmation link to the signed-in attendee. */
    sendEmailVerification(): Promise<EmailVerificationChallenge>
    /**
     * Applies the code from a confirmation link. Works signed out, since the link
     * may be opened on another device. Throws `ApiError('unauthorized')` when the
     * link has expired or been used.
     */
    verifyEmail(code: string): Promise<void>
    /** The signed-in attendee. Throws `ApiError('unauthorized')` when nobody is signed in. */
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

  /**
   * Buying. Every call needs a signed-in attendee.
   *
   * The server prices the order, holds the stock and opens a payment with the
   * provider; the attendee pays in the provider's checkout, and `verify` asks the
   * provider how it went. The provider also tells the server directly (Paystack's
   * webhook), so an order settles even if the app is closed mid-payment.
   */
  orders: {
    /**
     * Places an order and opens the payment for it.
     * Throws `ApiError('validation')` for a bad selection, `ApiError('sold_out')`
     * when stock ran out, `ApiError('conflict')` with too many unpaid orders open,
     * and `ApiError('unauthorized')` without a session.
     */
    checkout(input: CheckoutInput): Promise<PaymentIntent>
    list(): Promise<Order[]>
    /** Throws `ApiError('not_found')` for an order that is not the attendee's. */
    get(id: string): Promise<Order>
    /**
     * Opens the payment again for an unpaid order: the same attempt while it is
     * still open, a fresh one after a failure (holding the stock again).
     * Throws `ApiError('conflict')` when the order is already paid.
     */
    pay(orderId: string): Promise<PaymentIntent>
    /**
     * Asks the provider how the latest payment went and settles the order:
     * tickets when it succeeded, stock given back when it failed, no change while
     * it is still open. Safe to call any number of times.
     */
    verify(orderId: string): Promise<Order>
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
   * The answers that do not change through the week: how tickets work, what the
   * rules are, and who to ask. Public, and small enough to fetch in one call.
   */
  info: {
    get(): Promise<FestivalInfo>
  }

  /**
   * Festival announcements and changes. Public: no account needed, since an
   * attendee should see that a venue moved whether or not they signed in.
   * Everything is returned with the moment it was published, and the app shows
   * what the festival clock says has happened. Read state is the device's.
   */
  updates: {
    list(): Promise<FestivalUpdate[]>
  }

  /**
   * Push notifications. The app gets a push token from the browser (Firebase
   * Cloud Messaging) and registers the device here with what it wants: which
   * kinds, and which slots to be reminded about. The server sends from there,
   * so notifications arrive with the app closed. Every call needs a session.
   */
  notifications: {
    /** Saves (or refreshes) this device's registration under the signed-in attendee. */
    saveDevice(input: DeviceInput): Promise<void>
    /** Stops pushes to this device for this attendee: on turning them off, or signing out. */
    removeDevice(deviceId: string): Promise<void>
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
  | 'rate_limited'
  | 'unknown'

export const API_ERROR_CODES: readonly ApiErrorCode[] = [
  'not_found',
  'network',
  'validation',
  'unauthorized',
  'conflict',
  'sold_out',
  'rate_limited',
  'unknown',
]

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

/**
 * Turns schema issues into one `ApiError('validation')` that names the first
 * field at fault ("contact.email", "firstName"), so forms can show the message
 * beside it.
 */
export function validationError(
  issues: readonly { message: string; path: readonly PropertyKey[] }[],
  fallback: string,
): ApiError {
  const first = issues[0]
  return new ApiError('validation', first?.message ?? fallback, {
    issues,
    field: first?.path.map(String).join('.') || undefined,
  })
}

import { profileSchema, requestCodeSchema, setPinSchema, signInSchema, verifyCodeSchema } from '@afriff/validation'
import { ApiError } from '../contract'
import type { AttendeeApi } from '../contract'
import type {
  AuthSession,
  CodeChallenge,
  CodePurpose,
  ProfileInput,
  RequestCodeInput,
  SetPinInput,
  SignInInput,
  User,
  VerificationTicket,
  VerifyCodeInput,
} from '../types'
import { mockDb } from './db'

/**
 * Accounts, PINs, one-time codes and sessions for the mock API.
 *
 * It behaves like a small auth service. Signing in takes an email and a
 * six-digit PIN. Getting a PIN in the first place — signing up, or replacing a
 * forgotten one — goes through a code sent to the email, which is exchanged for
 * a short-lived ticket that authorises one PIN change.
 *
 * There is no mail integration yet, so `ACCEPT_ANY_CODE` waves any six digits
 * through; the code the service would have sent still comes back on the
 * challenge, so the screen can show it. Everything around it keeps the shape the
 * real service will have: codes and tickets expire, tickets are single-use, PINs
 * are stored only as a salted hash, and wrong PINs lock an account for a spell.
 *
 * State lives in memory and is mirrored to localStorage through `mockDb`, so a
 * reload keeps the account and the session.
 */

/**
 * No inbox to check offline, so any six-digit code passes. Set this to false the
 * day codes are actually delivered — the rest of the flow does not change.
 */
const ACCEPT_ANY_CODE: boolean = true

const CODE_TTL_MS = 10 * 60 * 1000
const TICKET_TTL_MS = 10 * 60 * 1000
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000
const MAX_PIN_ATTEMPTS = 5
const LOCKOUT_MS = 5 * 60 * 1000

/** What the "server" stores. The PIN hash and the lockout never leave this module. */
interface UserRecord extends User {
  pinHash: string
  pinSalt: string
  /** Wrong PINs since the last success. Reset on a correct PIN or a PIN change. */
  failedPins: number
  /** Epoch ms until which sign-in is refused, after too many wrong PINs. */
  lockedUntil?: number
}

interface Challenge {
  email: string
  purpose: CodePurpose
  code: string
  expiresAt: number
}

interface Ticket {
  token: string
  email: string
  purpose: CodePurpose
  expiresAt: number
}

interface SessionRecord {
  token: string
  userId: string
  expiresAt: number
}

interface AuthState {
  users: UserRecord[]
  sessions: SessionRecord[]
}

function randomId(prefix: string): string {
  const random = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID().replace(/-/g, '')
    : Math.random().toString(36).slice(2) + Date.now().toString(36)
  return `${prefix}_${random.slice(0, 20)}`
}

function randomCode(): string {
  const n = typeof crypto !== 'undefined' && crypto.getRandomValues
    ? crypto.getRandomValues(new Uint32Array(1))[0]!
    : Math.floor(Math.random() * 1_000_000)
  return String(n % 1_000_000).padStart(6, '0')
}

/**
 * PINs are salted and hashed, never stored in the clear: a copy of localStorage
 * should not hand anyone's PIN over, and the real service will do the same.
 */
async function hashPin(pin: string, salt: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${salt}:${pin}`)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

/** The public view of an account: everything to do with the PIN stays behind. */
function toUser(record: UserRecord): User {
  const { pinHash, pinSalt, failedPins, lockedUntil, ...user } = record
  return user
}

/** Surfaces the first schema message, so forms can show it next to the field. */
function fail(issues: { message: string; path: PropertyKey[] }[], fallback: string): never {
  const first = issues[0]
  throw new ApiError('validation', first?.message ?? fallback, { issues, field: first?.path[0] })
}

export interface MockAuth {
  api: AttendeeApi['auth']
  setToken(token: string | null): void
  /**
   * The signed-in attendee, for the other mock services to hang their work off.
   * Throws `ApiError('unauthorized')` when nobody is signed in.
   */
  currentUser(): User
}

/**
 * @param respond wraps every result in the adapter's simulated latency and deep copy.
 */
export function createMockAuth(respond: <T>(produce: () => T | Promise<T>) => Promise<T>): MockAuth {
  /** Fresh fallback arrays per adapter: `mockDb.read` hands the fallback straight back. */
  const state: AuthState = {
    users: mockDb.read<UserRecord[]>('users', []),
    sessions: mockDb.read<SessionRecord[]>('sessions', []),
  }
  /** Codes and tickets are deliberately not persisted: a reload mid-flow starts a fresh one. */
  const challenges = new Map<string, Challenge>()
  const tickets = new Map<string, Ticket>()
  let token: string | null = null

  const persist = () => {
    mockDb.write('users', state.users)
    mockDb.write('sessions', state.sessions)
  }

  const findUser = (email: string) => state.users.find((user) => user.email === email)

  function currentUser(): UserRecord {
    const now = Date.now()
    state.sessions = state.sessions.filter((session) => session.expiresAt > now)
    const session = token ? state.sessions.find((s) => s.token === token) : undefined
    const user = session ? state.users.find((u) => u.id === session.userId) : undefined
    if (!user) throw new ApiError('unauthorized', 'Sign in to continue.')
    return user
  }

  function startSession(user: UserRecord): AuthSession {
    const session: SessionRecord = {
      token: randomId('ses'),
      userId: user.id,
      expiresAt: Date.now() + SESSION_TTL_MS,
    }
    state.sessions.push(session)
    persist()
    token = session.token
    return { token: session.token, user: toUser(user), expiresAt: new Date(session.expiresAt).toISOString() }
  }

  return {
    setToken(value) {
      token = value
    },

    currentUser: () => toUser(currentUser()),

    api: {
      signIn: (input: SignInInput) =>
        respond(async (): Promise<AuthSession> => {
          const parsed = signInSchema.safeParse(input)
          if (!parsed.success) fail(parsed.error.issues, 'Check your email and PIN.')
          const { email, pin } = parsed.data

          /** One message for a wrong PIN and for an email with no account: which it was is not the caller's business. */
          const mismatch = () =>
            new ApiError('unauthorized', 'That email and PIN do not match. Check them and try again.', { field: 'pin' })

          const user = findUser(email)
          if (!user) throw mismatch()

          const now = Date.now()
          if (user.lockedUntil && user.lockedUntil > now) {
            const minutes = Math.ceil((user.lockedUntil - now) / 60_000)
            throw new ApiError(
              'unauthorized',
              `Too many wrong PINs. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}, or reset your PIN.`,
              { field: 'pin' },
            )
          }

          if (await hashPin(pin, user.pinSalt) !== user.pinHash) {
            user.failedPins += 1
            if (user.failedPins >= MAX_PIN_ATTEMPTS) {
              user.failedPins = 0
              user.lockedUntil = now + LOCKOUT_MS
              persist()
              throw new ApiError('unauthorized', 'Too many wrong PINs. Try again in 5 minutes, or reset your PIN.', {
                field: 'pin',
              })
            }
            persist()
            throw mismatch()
          }

          user.failedPins = 0
          delete user.lockedUntil
          return startSession(user)
        }),

      requestCode: (input: RequestCodeInput) =>
        respond((): CodeChallenge => {
          const parsed = requestCodeSchema.safeParse(input)
          if (!parsed.success) fail(parsed.error.issues, 'Enter a valid email address.')
          const { email, purpose } = parsed.data

          const existing = findUser(email)
          if (purpose === 'signup' && existing) {
            throw new ApiError('conflict', 'That email already has an account. Sign in instead.', { field: 'email' })
          }
          if (purpose === 'reset' && !existing) {
            // A real service would not say which emails it knows. Offline there is no
            // inbox to check, so staying quiet would strand the attendee on a dead step.
            throw new ApiError('not_found', 'We have no account for that email. Create one instead.', {
              field: 'email',
            })
          }

          const code = randomCode()
          const expiresAt = Date.now() + CODE_TTL_MS
          challenges.set(email, { email, purpose, code, expiresAt })
          return { email, purpose, expiresAt: new Date(expiresAt).toISOString(), devCode: code }
        }),

      verifyCode: (input: VerifyCodeInput) =>
        respond((): VerificationTicket => {
          const parsed = verifyCodeSchema.safeParse(input)
          if (!parsed.success) fail(parsed.error.issues, 'Enter the six-digit code.')
          const { email, code } = parsed.data

          const challenge = challenges.get(email)
          if (!challenge || challenge.expiresAt < Date.now()) {
            challenges.delete(email)
            throw new ApiError('unauthorized', 'That code has expired. Ask for a new one.', { field: 'code' })
          }
          if (!ACCEPT_ANY_CODE && challenge.code !== code) {
            throw new ApiError('unauthorized', 'That code is not right. Check it and try again.', { field: 'code' })
          }
          challenges.delete(email)

          const ticket: Ticket = {
            token: randomId('vrf'),
            email,
            purpose: challenge.purpose,
            expiresAt: Date.now() + TICKET_TTL_MS,
          }
          tickets.set(ticket.token, ticket)
          return {
            token: ticket.token,
            email,
            purpose: ticket.purpose,
            expiresAt: new Date(ticket.expiresAt).toISOString(),
            name: ticket.purpose === 'reset' ? findUser(email)?.name : undefined,
          }
        }),

      setPin: (input: SetPinInput) =>
        respond(async (): Promise<AuthSession> => {
          const parsed = setPinSchema.safeParse(input)
          if (!parsed.success) fail(parsed.error.issues, 'Pick a six-digit PIN.')
          const { ticket: ticketToken, pin, name } = parsed.data

          const ticket = tickets.get(ticketToken)
          if (!ticket || ticket.expiresAt < Date.now()) {
            tickets.delete(ticketToken)
            throw new ApiError('unauthorized', 'That verification has expired. Start again.')
          }
          tickets.delete(ticketToken)

          const pinSalt = randomId('slt')
          const pinHash = await hashPin(pin, pinSalt)
          const existing = findUser(ticket.email)
          let account: UserRecord

          if (ticket.purpose === 'signup') {
            if (existing) {
              throw new ApiError('conflict', 'That email already has an account. Sign in instead.', { field: 'email' })
            }
            if (!name) {
              throw new ApiError('validation', 'Tell us your name to finish setting up your account.', {
                field: 'name',
              })
            }
            account = {
              id: randomId('usr'),
              email: ticket.email,
              name,
              createdAt: new Date().toISOString(),
              pinHash,
              pinSalt,
              failedPins: 0,
            }
            state.users.push(account)
          }
          else {
            if (!existing) throw new ApiError('not_found', 'We have no account for that email.', { field: 'email' })
            account = existing
            account.pinHash = pinHash
            account.pinSalt = pinSalt
            account.failedPins = 0
            delete account.lockedUntil
            // A new PIN ends the account's other sessions, the way a password change does.
            state.sessions = state.sessions.filter((session) => session.userId !== account.id)
          }

          return startSession(account)
        }),

      me: () => respond(() => toUser(currentUser())),

      updateProfile: (input: ProfileInput) =>
        respond(() => {
          const user = currentUser()
          const parsed = profileSchema.safeParse(input)
          if (!parsed.success) fail(parsed.error.issues, 'Check the details and try again.')
          user.name = parsed.data.name
          const phone = parsed.data.phone?.trim()
          if (phone) user.phone = phone
          else delete user.phone
          persist()
          return toUser(user)
        }),

      signOut: () =>
        respond(() => {
          state.sessions = state.sessions.filter((session) => session.token !== token)
          persist()
          token = null
        }),
    },
  }
}

import { actionCodeSchema, passwordResetRequestSchema, passwordResetSchema, profileSchema, signInSchema, signUpSchema } from '@afriff/validation'
import { ApiError, validationError } from '../contract'
import type { AttendeeApi } from '../contract'
import type {
  EmailVerificationChallenge,
  PasswordResetChallenge,
  PasswordResetInput,
  PasswordResetRequestInput,
  ProfileInput,
  SignInInput,
  SignUpInput,
  User,
} from '../types'
import { mockDb } from './db'
import { sha256Hex } from './sha256'

/**
 * Accounts and sessions for the mock API, shaped like Firebase Auth so the two
 * adapters behave alike: an email and a password, a link to reset a forgotten
 * password, and a link to confirm the email address.
 *
 * There is no mail here. A reset or confirmation hands back the code its link
 * would carry (`devCode`), so the app can offer to open the link on screen and
 * the whole flow can be finished offline. Everything around it keeps the shape
 * of the real service: links expire and work once, passwords are stored only as
 * a salted hash, wrong passwords lock an account for a spell, and a reset ends
 * the account's other sessions.
 *
 * State lives in memory and is mirrored to localStorage through `mockDb`, so a
 * reload keeps the account and the session. The session belongs to the adapter,
 * as Firebase's does; the app only ever asks who is signed in.
 */

const LINK_TTL_MS = 60 * 60 * 1000
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000
const MAX_FAILED_SIGN_INS = 5
const LOCKOUT_MS = 5 * 60 * 1000

/** What the "server" stores. Everything to do with the password stays in this module. */
interface UserRecord extends User {
  passwordHash: string
  passwordSalt: string
  /** Wrong passwords since the last success. */
  failedSignIns: number
  /** Epoch ms until which sign-in is refused, after too many wrong passwords. */
  lockedUntil?: number
}

interface SessionRecord {
  token: string
  userId: string
  expiresAt: number
}

/** What an emailed link would carry: what it is for, for whom, and until when. */
interface ActionCode {
  purpose: 'reset' | 'verify'
  email: string
  expiresAt: number
}

function randomToken(prefix: string): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return `${prefix}_${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`
}

/**
 * Salted and hashed, never stored in the clear: a copy of localStorage should
 * not hand anyone's password over. (Firebase uses scrypt; a demo can make do.)
 */
function hashPassword(password: string, salt: string): string {
  return sha256Hex(`${salt}:${password}`)
}

function fullName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`
}

/** The public view of an account. */
function toUser(record: UserRecord): User {
  const { passwordHash, passwordSalt, failedSignIns, lockedUntil, ...user } = record
  return user
}

export interface MockAuth {
  api: AttendeeApi['auth']
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
  const users = mockDb.read<UserRecord[]>('users', [])
  let sessions = mockDb.read<SessionRecord[]>('sessions', [])
  /** This device's session, the way Firebase keeps its own in IndexedDB. */
  let token = mockDb.read<string | null>('current', null)
  /** Links are deliberately not persisted: a reload makes them stale, as an old email would be. */
  const codes = new Map<string, ActionCode>()

  const persist = () => {
    mockDb.write('users', users)
    mockDb.write('sessions', sessions)
    mockDb.write('current', token)
  }

  const findUser = (email: string) => users.find((user) => user.email === email)

  function sessionUser(): UserRecord | undefined {
    const now = Date.now()
    sessions = sessions.filter((session) => session.expiresAt > now)
    const session = token ? sessions.find((item) => item.token === token) : undefined
    return session ? users.find((user) => user.id === session.userId) : undefined
  }

  function currentUser(): UserRecord {
    const user = sessionUser()
    if (!user) throw new ApiError('unauthorized', 'Sign in to continue.')
    return user
  }

  function startSession(user: UserRecord): User {
    const session: SessionRecord = { token: randomToken('ses'), userId: user.id, expiresAt: Date.now() + SESSION_TTL_MS }
    sessions.push(session)
    token = session.token
    persist()
    return toUser(user)
  }

  function issueCode(purpose: ActionCode['purpose'], email: string): string {
    const code = randomToken(purpose === 'reset' ? 'rst' : 'vfy')
    codes.set(code, { purpose, email, expiresAt: Date.now() + LINK_TTL_MS })
    return code
  }

  /** The same words Firebase's handler would warrant, for a link that is spent, stale or made up. */
  function readCode(code: string, purpose: ActionCode['purpose']): ActionCode {
    const parsed = actionCodeSchema.safeParse(code)
    const found = parsed.success ? codes.get(parsed.data) : undefined
    if (!found || found.purpose !== purpose || found.expiresAt < Date.now()) {
      throw new ApiError('unauthorized', 'That link has expired or has already been used. Ask for a new one.')
    }
    return found
  }

  return {
    currentUser: () => toUser(currentUser()),

    api: {
      restore: () => respond(() => {
        const user = sessionUser()
        if (!user && token) {
          token = null
          persist()
        }
        return user ? toUser(user) : null
      }),

      // One tab, one adapter: nothing changes behind the app's back in the demo.
      onSessionChange: () => () => {},

      signIn: (input: SignInInput) =>
        respond((): User => {
          const parsed = signInSchema.safeParse(input)
          if (!parsed.success) throw validationError(parsed.error.issues, 'Check your email and password.')
          const { email, password } = parsed.data

          /** One message for a wrong password and for an email with no account: which it was is not the caller's business. */
          const mismatch = () =>
            new ApiError('unauthorized', 'That email and password do not match. Check them and try again.', {
              field: 'password',
            })

          const user = findUser(email)
          if (!user) throw mismatch()

          const now = Date.now()
          if (user.lockedUntil && user.lockedUntil > now) {
            throw new ApiError('rate_limited', 'Too many wrong passwords. Wait a few minutes, or reset your password.', {
              field: 'password',
            })
          }

          if (hashPassword(password, user.passwordSalt) !== user.passwordHash) {
            user.failedSignIns += 1
            if (user.failedSignIns >= MAX_FAILED_SIGN_INS) {
              user.failedSignIns = 0
              user.lockedUntil = now + LOCKOUT_MS
              persist()
              throw new ApiError('rate_limited', 'Too many wrong passwords. Wait a few minutes, or reset your password.', {
                field: 'password',
              })
            }
            persist()
            throw mismatch()
          }

          user.failedSignIns = 0
          delete user.lockedUntil
          return startSession(user)
        }),

      signUp: (input: SignUpInput) =>
        respond((): User => {
          const parsed = signUpSchema.safeParse(input)
          if (!parsed.success) throw validationError(parsed.error.issues, 'Check your details and try again.')
          const { email, password, firstName, lastName } = parsed.data
          if (findUser(email)) {
            throw new ApiError('conflict', 'That email already has an account. Sign in instead.', { field: 'email' })
          }
          const passwordSalt = randomToken('slt')
          const user: UserRecord = {
            id: randomToken('usr').slice(0, 24),
            email,
            emailVerified: false,
            firstName,
            lastName,
            name: fullName(firstName, lastName),
            createdAt: new Date().toISOString(),
            passwordHash: hashPassword(password, passwordSalt),
            passwordSalt,
            failedSignIns: 0,
          }
          users.push(user)
          return startSession(user)
        }),

      requestPasswordReset: (input: PasswordResetRequestInput) =>
        respond((): PasswordResetChallenge => {
          const parsed = passwordResetRequestSchema.safeParse(input)
          if (!parsed.success) throw validationError(parsed.error.issues, 'Enter a valid email address.')
          const { email } = parsed.data
          // No account, no link — and the same answer either way.
          return findUser(email) ? { email, devCode: issueCode('reset', email) } : { email }
        }),

      checkPasswordReset: (code: string) => respond(() => ({ email: readCode(code, 'reset').email })),

      resetPassword: (input: PasswordResetInput) =>
        respond((): User => {
          const parsed = passwordResetSchema.safeParse(input)
          if (!parsed.success) throw validationError(parsed.error.issues, 'Choose a new password.')
          const found = readCode(parsed.data.code, 'reset')
          const user = findUser(found.email)
          if (!user) throw new ApiError('unauthorized', 'That link has expired or has already been used. Ask for a new one.')
          codes.delete(parsed.data.code)

          user.passwordSalt = randomToken('slt')
          user.passwordHash = hashPassword(parsed.data.password, user.passwordSalt)
          user.failedSignIns = 0
          delete user.lockedUntil
          // Opening the link proves the inbox, the way Firebase treats it.
          user.emailVerified = true
          // A new password ends the account's other sessions.
          sessions = sessions.filter((session) => session.userId !== user.id)
          return startSession(user)
        }),

      sendEmailVerification: () =>
        respond((): EmailVerificationChallenge => {
          const user = currentUser()
          return user.emailVerified ? { email: user.email } : { email: user.email, devCode: issueCode('verify', user.email) }
        }),

      verifyEmail: (code: string) =>
        respond(() => {
          const found = readCode(code, 'verify')
          codes.delete(code.trim())
          const user = findUser(found.email)
          if (user) {
            user.emailVerified = true
            persist()
          }
        }),

      me: () => respond(() => toUser(currentUser())),

      updateProfile: (input: ProfileInput) =>
        respond(() => {
          const user = currentUser()
          const parsed = profileSchema.safeParse(input)
          if (!parsed.success) throw validationError(parsed.error.issues, 'Check the details and try again.')
          user.firstName = parsed.data.firstName
          user.lastName = parsed.data.lastName
          user.name = fullName(user.firstName, user.lastName)
          const phone = parsed.data.phone?.trim()
          if (phone) user.phone = phone
          else delete user.phone
          persist()
          return toUser(user)
        }),

      signOut: () =>
        respond(() => {
          sessions = sessions.filter((session) => session.token !== token)
          token = null
          persist()
        }),
    },
  }
}

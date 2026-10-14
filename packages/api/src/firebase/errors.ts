import { FirebaseError } from 'firebase/app'
import { API_ERROR_CODES, ApiError, isApiError } from '../contract'
import type { ApiErrorCode } from '../contract'

/**
 * Turns whatever the Firebase SDKs throw into the `ApiError` the app already
 * knows how to show, with the same words and the same `field` the mock uses.
 */

type Mapped = [code: ApiErrorCode, message: string, field?: string]

const MISMATCH: Mapped = ['unauthorized', 'That email and password do not match. Check them and try again.', 'password']
const STALE_LINK: Mapped = ['unauthorized', 'That link has expired or has already been used. Ask for a new one.']

const AUTH: Record<string, Mapped> = {
  // With email enumeration protection on (the default), a wrong password and an
  // unknown email both arrive as `invalid-credential`; older projects send the others.
  'auth/invalid-credential': MISMATCH,
  'auth/invalid-login-credentials': MISMATCH,
  'auth/wrong-password': MISMATCH,
  'auth/user-not-found': MISMATCH,
  'auth/invalid-email': ['validation', 'Enter a valid email address.', 'email'],
  'auth/missing-email': ['validation', 'Enter your email address.', 'email'],
  'auth/missing-password': ['validation', 'Enter your password.', 'password'],
  'auth/email-already-in-use': ['conflict', 'That email already has an account. Sign in instead.', 'email'],
  'auth/weak-password': ['validation', 'Use at least 8 characters.', 'password'],
  'auth/password-does-not-meet-requirements': ['validation', 'That password does not meet the rules. Make it longer.', 'password'],
  'auth/too-many-requests': ['rate_limited', 'Too many attempts. Wait a few minutes, or reset your password.', 'password'],
  'auth/user-disabled': ['unauthorized', 'This account has been switched off. Contact the festival desk.'],
  'auth/user-token-expired': ['unauthorized', 'Your session has ended. Sign in again.'],
  'auth/requires-recent-login': ['unauthorized', 'Sign in again to do that.'],
  'auth/expired-action-code': STALE_LINK,
  'auth/invalid-action-code': STALE_LINK,
  'auth/network-request-failed': ['network', 'You seem to be offline. Check your connection and try again.'],
  'auth/unauthorized-continue-uri': ['unknown', 'This app is not allowed to send that email yet. Contact the festival desk.'],
}

/** Firestore and Functions share gRPC's status names. */
const STATUS: Record<string, Mapped> = {
  'permission-denied': ['unauthorized', 'You do not have access to that.'],
  unauthenticated: ['unauthorized', 'Sign in to continue.'],
  'not-found': ['not_found', 'We could not find that.'],
  'invalid-argument': ['validation', 'Check the details and try again.'],
  'failed-precondition': ['conflict', 'That cannot be done right now.'],
  'already-exists': ['conflict', 'That already exists.'],
  'resource-exhausted': ['rate_limited', 'Too many requests. Wait a moment and try again.'],
  unavailable: ['network', 'You seem to be offline. Check your connection and try again.'],
  'deadline-exceeded': ['network', 'That took too long. Check your connection and try again.'],
}

function isApiErrorCode(value: unknown): value is ApiErrorCode {
  return typeof value === 'string' && (API_ERROR_CODES as readonly string[]).includes(value)
}

export function toApiError(error: unknown): ApiError {
  if (isApiError(error)) return error
  if (!(error instanceof FirebaseError)) {
    return new ApiError('unknown', 'Something went wrong. Try again.', { cause: String(error) })
  }

  // A callable re-throws our own `ApiError` with its code and details intact. The
  // Functions SDK appends the HTTP status to the message ("… [400]"); attendees
  // read these messages, so it comes off.
  const details = (error as FirebaseError & { details?: unknown }).details
  if (details && typeof details === 'object' && isApiErrorCode((details as { code?: unknown }).code)) {
    const { code, ...rest } = details as { code: ApiErrorCode } & Record<string, unknown>
    return new ApiError(code, error.message.replace(/\s*\[\d{3}\]$/, ''), rest)
  }

  const mapped = AUTH[error.code] ?? STATUS[error.code.replace(/^(functions|firestore)\//, '')]
  if (mapped) {
    const [code, message, field] = mapped
    return new ApiError(code, message, { firebaseCode: error.code, ...(field ? { field } : {}) })
  }
  return new ApiError('unknown', 'Something went wrong. Try again.', { firebaseCode: error.code })
}

/** Reading someone else's order or ticket is refused by the rules; to the app it simply does not exist. */
export function isPermissionDenied(error: unknown): boolean {
  return error instanceof FirebaseError && /permission-denied$/.test(error.code)
}

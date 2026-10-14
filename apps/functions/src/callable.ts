import { logger } from 'firebase-functions'
import { HttpsError, onCall } from 'firebase-functions/https'
import type { CallableOptions, FunctionsErrorCode } from 'firebase-functions/https'
import type { ZodType } from 'zod'
import { ApiError, isApiError, validationError } from '@afriff/api'
import type { ApiErrorCode } from '@afriff/api'
import { isStaffRole } from '@afriff/api/door'
import type { StaffRole } from '@afriff/api/door'
import type { CallableContract, CallableErrorDetails, CallableName } from '@afriff/api/firebase/schema'

/**
 * Callable functions speak the app's language: they throw `ApiError`, which goes
 * over the wire as an `HttpsError` carrying the original code and details, and
 * the browser adapter turns it back into the same `ApiError`.
 */

const STATUS: Record<ApiErrorCode, FunctionsErrorCode> = {
  not_found: 'not-found',
  network: 'unavailable',
  validation: 'invalid-argument',
  unauthorized: 'unauthenticated',
  conflict: 'failed-precondition',
  sold_out: 'resource-exhausted',
  rate_limited: 'resource-exhausted',
  unknown: 'internal',
}

export function toHttpsError(error: unknown): HttpsError {
  if (error instanceof HttpsError) return error
  if (isApiError(error)) {
    const details: CallableErrorDetails = { ...error.details, code: error.code }
    return new HttpsError(STATUS[error.code], error.message, details)
  }
  logger.error('Unexpected error in a callable function', error)
  return new HttpsError('internal', 'Something went wrong on our side. Try again in a moment.', { code: 'unknown' })
}

/** Parses a request with a shared schema, or fails the way the mock does. */
export function parse<T>(schema: ZodType<T>, data: unknown, fallback: string): T {
  const parsed = schema.safeParse(data)
  if (!parsed.success) throw validationError(parsed.error.issues, fallback)
  return parsed.data
}

export interface Caller {
  uid: string
  email?: string
  emailVerified: boolean
  /** Name on the sign-in, if any. */
  name?: string
  /** Set for festival staff by `bun run staff`. */
  role?: StaffRole
}

/**
 * A callable that needs a signed-in attendee, typed by the shared contract so
 * the browser and the server cannot disagree about what is sent and returned.
 */
export function callable<N extends CallableName>(
  options: CallableOptions,
  handler: (data: unknown, caller: Caller) => Promise<CallableContract[N]['response']>,
) {
  return onCall<CallableContract[N]['request'], Promise<CallableContract[N]['response']>>(options, async (request) => {
    if (!request.auth) throw toHttpsError(new ApiError('unauthorized', 'Sign in to continue.'))
    const { uid, token } = request.auth
    try {
      return await handler(request.data, {
        uid,
        email: token.email,
        emailVerified: token.email_verified === true,
        name: typeof token.name === 'string' ? token.name : undefined,
        role: isStaffRole(token.role) ? token.role : undefined,
      })
    }
    catch (error) {
      throw toHttpsError(error)
    }
  })
}

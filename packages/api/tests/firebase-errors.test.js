import { describe, expect, test } from 'bun:test'
import { FirebaseError } from 'firebase/app'
import { ApiError } from '@afriff/api'
import { isPermissionDenied, toApiError } from '../src/firebase/errors'

/** A callable error as the Functions SDK raises it. */
function callableError(code, message, details) {
  const error = new FirebaseError(`functions/${code}`, message)
  error.details = details
  return error
}

describe('Firebase errors, as the app sees them', () => {
  test('a callable’s own ApiError comes back with its code, details and clean message', () => {
    const error = toApiError(callableError('resource-exhausted', 'Only 2 left for Festival Pass. [429]', {
      code: 'sold_out',
      productId: 'prod_festival_pass',
      remaining: 2,
    }))
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ code: 'sold_out', message: 'Only 2 left for Festival Pass.', details: { productId: 'prod_festival_pass', remaining: 2 } })
  })

  test('a wrong password and an unknown email read the same, against the password field', () => {
    for (const code of ['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found']) {
      expect(toApiError(new FirebaseError(code, 'Firebase: Error'))).toMatchObject({
        code: 'unauthorized',
        message: 'That email and password do not match. Check them and try again.',
        details: { field: 'password' },
      })
    }
  })

  test('auth errors land on the field they are about', () => {
    expect(toApiError(new FirebaseError('auth/email-already-in-use', 'x'))).toMatchObject({ code: 'conflict', details: { field: 'email' } })
    expect(toApiError(new FirebaseError('auth/weak-password', 'x'))).toMatchObject({ code: 'validation', details: { field: 'password' } })
    expect(toApiError(new FirebaseError('auth/too-many-requests', 'x'))).toMatchObject({ code: 'rate_limited' })
    expect(toApiError(new FirebaseError('auth/expired-action-code', 'x'))).toMatchObject({ code: 'unauthorized' })
    expect(toApiError(new FirebaseError('auth/network-request-failed', 'x'))).toMatchObject({ code: 'network' })
  })

  test('Firestore and Functions statuses map onto the app’s codes', () => {
    expect(toApiError(new FirebaseError('permission-denied', 'x'))).toMatchObject({ code: 'unauthorized' })
    expect(toApiError(new FirebaseError('unavailable', 'x'))).toMatchObject({ code: 'network' })
    expect(toApiError(callableError('internal', 'INTERNAL [500]', undefined))).toMatchObject({ code: 'unknown' })
    expect(isPermissionDenied(new FirebaseError('permission-denied', 'x'))).toBe(true)
    expect(isPermissionDenied(new FirebaseError('functions/permission-denied', 'x'))).toBe(true)
    expect(isPermissionDenied(new Error('permission-denied'))).toBe(false)
  })

  test('anything else is unknown, and an ApiError passes through untouched', () => {
    expect(toApiError(new Error('boom'))).toMatchObject({ code: 'unknown' })
    const original = new ApiError('conflict', 'Already paid.')
    expect(toApiError(original)).toBe(original)
  })
})

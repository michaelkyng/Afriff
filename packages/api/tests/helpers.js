import { createMockApi } from '@afriff/api/mock'

/** Shared set-up for the mock API suites. A fresh adapter per test: state lives inside it. */

export const PASSWORD = 'harmattan breeze'

export const CONTACT = { name: 'Ada Okoye', email: 'ada@example.com', phone: '0803 123 4567' }

export const newApi = () => createMockApi({ latency: 0 })

/** Creates an account and leaves it signed in. */
export async function signUp(api, { email = 'ada@example.com', firstName = 'Ada', lastName = 'Okoye', password = PASSWORD } = {}) {
  return api.auth.signUp({ email, password, firstName, lastName })
}

/** A fresh adapter with Ada signed in. */
export async function signedIn(email = 'ada@example.com') {
  const api = newApi()
  await signUp(api, { email })
  return api
}

/** Confirms the signed-in attendee's email through the link the mock would have sent. */
export async function confirmEmail(api) {
  const { devCode } = await api.auth.sendEmailVerification()
  await api.auth.verifyEmail(devCode)
}

/**
 * Checks out and pays in the stand-in checkout, the way the app does: open the
 * payment, let the attendee finish it, then ask how it went.
 */
export async function buy(api, items, { outcome = 'success', contact = CONTACT } = {}) {
  const intent = await api.orders.checkout({ items, contact })
  if (outcome) api.gateway.complete(intent.reference, outcome)
  return api.orders.verify(intent.orderId)
}

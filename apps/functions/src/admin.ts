import { getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { COLLECTIONS } from '@afriff/api/firebase/schema'

/**
 * The Admin SDK, with the credentials of the function's service account. It
 * bypasses the security rules, so everything written through it is checked here.
 */
const app = getApps()[0] ?? initializeApp()

export const db = getFirestore(app)
// Optional fields are simply left out, as the domain models expect.
db.settings({ ignoreUndefinedProperties: true })

export const adminAuth = getAuth(app)

export const collections = {
  orders: () => db.collection(COLLECTIONS.orders),
  tickets: () => db.collection(COLLECTIONS.tickets),
  mail: () => db.collection(COLLECTIONS.mail),
  paymentEvents: () => db.collection(COLLECTIONS.paymentEvents),
  products: () => db.collection(COLLECTIONS.products),
  screenings: () => db.collection(COLLECTIONS.screenings),
  users: () => db.collection(COLLECTIONS.users),
}

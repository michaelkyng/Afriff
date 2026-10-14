import { initializeApp } from 'firebase/app'
import type { FirebaseApp } from 'firebase/app'
import {
  browserLocalPersistence,
  connectAuthEmulator,
  indexedDBLocalPersistence,
  initializeAuth,
  inMemoryPersistence,
} from 'firebase/auth'
import type { Auth } from 'firebase/auth'
import {
  connectFirestoreEmulator,
  initializeFirestore,
  memoryLocalCache,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore'
import type { Firestore } from 'firebase/firestore'
import { connectFunctionsEmulator, getFunctions } from 'firebase/functions'
import type { Functions } from 'firebase/functions'

/**
 * The Firebase web config for one project, plus how this app wants to use it.
 *
 * None of this is secret: a web API key only identifies the project. What an
 * attendee can read and write is decided by `firebase/firestore.rules` and the
 * Cloud Functions. Server credentials (service accounts, the Paystack secret,
 * the Brevo key) never belong here.
 */
export interface FirebaseClientConfig {
  apiKey: string
  authDomain: string
  projectId: string
  appId: string
  /** Where the callable Cloud Functions run. Must match `apps/functions`. */
  functionsRegion: string
  /**
   * Host of the local Emulator Suite, e.g. `127.0.0.1`. When set, Auth,
   * Firestore and Functions all talk to the emulators and nothing reaches a
   * real project.
   */
  emulatorHost?: string
  /**
   * `device` (the default) keeps the session and Firestore's cache in IndexedDB,
   * so tickets open offline and the session survives a restart. `memory` is for
   * tests and Node.
   */
  persistence?: 'device' | 'memory'
  /** Firebase app name, for running more than one client in a process. */
  name?: string
}

/** The ports in `firebase.json`. */
export const EMULATOR_PORTS = { auth: 9099, firestore: 8080, functions: 5001 } as const

export interface FirebaseClient {
  app: FirebaseApp
  auth: Auth
  db: Firestore
  functions: Functions
  /** True when talking to the local emulators. */
  emulated: boolean
}

/** Project ids are 6 to 30 characters of lower-case letters, digits and hyphens. */
const PROJECT_ID = /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/

/**
 * Checks the config before the SDK sees it, so a missing environment variable
 * fails with a sentence rather than an opaque SDK error on the first sign-in.
 */
export function assertFirebaseConfig(config: FirebaseClientConfig): void {
  const problems: string[] = []
  const projectId = config.projectId.trim()
  const emulated = Boolean(config.emulatorHost?.trim())

  if (!PROJECT_ID.test(projectId)) problems.push('a valid project id (NUXT_PUBLIC_FIREBASE_PROJECT_ID)')
  if (!config.functionsRegion.trim()) problems.push('the functions region (NUXT_PUBLIC_FIREBASE_FUNCTIONS_REGION)')
  if (!emulated) {
    if (!config.apiKey.trim()) problems.push('the web API key (NUXT_PUBLIC_FIREBASE_API_KEY)')
    if (!config.authDomain.trim()) problems.push('the auth domain (NUXT_PUBLIC_FIREBASE_AUTH_DOMAIN)')
    if (!config.appId.trim()) problems.push('the web app id (NUXT_PUBLIC_FIREBASE_APP_ID)')
    // `demo-` projects exist only in the emulators; pointing at one for real is a mistake.
    if (projectId.startsWith('demo-')) problems.push('a real project: demo- projects only run in the emulators')
  }
  if (problems.length) throw new Error(`Firebase needs ${problems.join(', ')}.`)
}

/**
 * Call once from an app's client-only plugin and pass the result to the API
 * adapter. No environment reads or globals: apps own configuration and lifecycle.
 */
export function createFirebaseClient(config: FirebaseClientConfig): FirebaseClient {
  assertFirebaseConfig(config)
  const host = config.emulatorHost?.trim()
  const onDevice = (config.persistence ?? 'device') === 'device'

  const app = initializeApp(
    {
      apiKey: config.apiKey.trim() || 'emulator',
      authDomain: config.authDomain.trim() || `${config.projectId.trim()}.firebaseapp.com`,
      projectId: config.projectId.trim(),
      appId: config.appId.trim() || undefined,
    },
    config.name,
  )

  const auth = initializeAuth(app, {
    // IndexedDB first, as the SDK recommends; localStorage where IndexedDB is unavailable.
    persistence: onDevice ? [indexedDBLocalPersistence, browserLocalPersistence] : inMemoryPersistence,
  })

  const db = initializeFirestore(app, {
    localCache: onDevice
      ? persistentLocalCache({ tabManager: persistentMultipleTabManager() })
      : memoryLocalCache(),
    // Optional fields are left out of writes rather than failing them.
    ignoreUndefinedProperties: true,
  })

  const functions = getFunctions(app, config.functionsRegion.trim())

  if (host) {
    connectAuthEmulator(auth, `http://${host}:${EMULATOR_PORTS.auth}`, { disableWarnings: true })
    connectFirestoreEmulator(db, host, EMULATOR_PORTS.firestore)
    connectFunctionsEmulator(functions, host, EMULATOR_PORTS.functions)
  }

  return { app, auth, db, functions, emulated: Boolean(host) }
}

import type { FirebaseApp } from 'firebase/app'

/**
 * Web push through Firebase Cloud Messaging: only the token, which is what the
 * server needs to reach this browser. Showing a notification and opening the
 * app from it are the app's own service worker's job, so FCM's is never
 * installed and nothing else of the SDK runs.
 *
 * Its own entry point, so an app that never turns push on never downloads it.
 */
export interface PushTokens {
  /** This browser's token, subscribing it through the app's service worker if it is not already. */
  getToken(registration: ServiceWorkerRegistration): Promise<string>
  /** Unsubscribes this browser; its token stops working. */
  deleteToken(): Promise<void>
}

/**
 * `null` where this browser cannot do push at all (no service worker or Push
 * API, or Safari on iOS outside an installed Home Screen app).
 *
 * `vapidKey` is the public key of the project's web push certificate (Firebase
 * console → Project settings → Cloud Messaging). Not secret.
 */
export async function createPushTokens(app: FirebaseApp, vapidKey: string): Promise<PushTokens | null> {
  const { deleteToken, getMessaging, getToken, isSupported } = await import('firebase/messaging')
  if (!(await isSupported())) return null
  const messaging = getMessaging(app)
  return {
    getToken: (registration) => getToken(messaging, { vapidKey, serviceWorkerRegistration: registration }),
    deleteToken: async () => {
      await deleteToken(messaging)
    },
  }
}

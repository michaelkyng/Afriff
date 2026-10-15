import type { AttendeeApi } from '@afriff/api'
import type { MockGateway } from '@afriff/api/mock'
import type { PushTokens } from '@afriff/firebase/messaging'

/** Loads Cloud Messaging on first use; resolves to null where this browser cannot do push. */
export type PushProvider = () => Promise<PushTokens | null>

/**
 * Provides the API adapter as `$api` (use it through `useApi()`), chosen by
 * `NUXT_PUBLIC_API_MODE`. Each adapter is loaded only when chosen, so a Firebase
 * build carries no placeholder data and a mock build no Firebase SDK.
 *
 * `$mockGateway` is the stand-in for Paystack's checkout, and exists only in mock mode.
 * `$push` is how this browser gets a push token, and exists only against a real
 * Firebase project with Cloud Messaging configured: the mock and the emulators
 * have nothing to send pushes.
 */
export default defineNuxtPlugin({
  name: 'api',
  async setup() {
    const config = useRuntimeConfig().public
    let api: AttendeeApi
    let mockGateway: MockGateway | null = null
    let push: PushProvider | null = null

    switch (config.apiMode) {
      case 'firebase': {
        const [{ createFirebaseClient }, { createFirebaseApi }] = await Promise.all([
          import('@afriff/firebase'),
          import('@afriff/api/firebase'),
        ])
        const { vapidKey, ...firebase } = config.firebase
        const client = createFirebaseClient({ ...firebase })
        api = createFirebaseApi({ ...client, appUrl: config.appUrl || window.location.origin })
        if (vapidKey && firebase.messagingSenderId && !client.emulated) {
          let tokens: Promise<PushTokens | null> | undefined
          push = () => (tokens ??= import('@afriff/firebase/messaging')
            .then(({ createPushTokens }) => createPushTokens(client.app, vapidKey))
            .catch((error) => {
              // Offline the first time: try loading it again next time.
              tokens = undefined
              throw error
            }))
        }
        break
      }
      case 'mock': {
        const { createMockApi } = await import('@afriff/api/mock')
        const mock = createMockApi({ latency: Number(config.mockLatency) || 0 })
        api = mock
        mockGateway = mock.gateway
        break
      }
      default:
        // A typo must never quietly ship the mock, where nothing bought is real.
        throw new Error(`Unknown NUXT_PUBLIC_API_MODE "${config.apiMode}". Use "mock" or "firebase".`)
    }

    return { provide: { api, mockGateway, push } }
  },
})

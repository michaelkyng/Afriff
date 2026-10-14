import type { AttendeeApi } from '@afriff/api'
import type { MockGateway } from '@afriff/api/mock'

/**
 * Provides the API adapter as `$api` (use it through `useApi()`), chosen by
 * `NUXT_PUBLIC_API_MODE`. Each adapter is loaded only when chosen, so a Firebase
 * build carries no placeholder data and a mock build no Firebase SDK.
 *
 * `$mockGateway` is the stand-in for Paystack's checkout, and exists only in mock mode.
 */
export default defineNuxtPlugin({
  name: 'api',
  async setup() {
    const config = useRuntimeConfig().public
    let api: AttendeeApi
    let mockGateway: MockGateway | null = null

    switch (config.apiMode) {
      case 'firebase': {
        const [{ createFirebaseClient }, { createFirebaseApi }] = await Promise.all([
          import('@afriff/firebase'),
          import('@afriff/api/firebase'),
        ])
        const client = createFirebaseClient({ ...config.firebase })
        api = createFirebaseApi({ ...client, appUrl: config.appUrl || window.location.origin })
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

    return { provide: { api, mockGateway } }
  },
})

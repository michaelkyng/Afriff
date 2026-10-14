import type { DoorApi, SessionRef } from '@afriff/api/door'
import type { DemoTicket } from '@afriff/api/mock/door'

/**
 * Provides the door API as `$door` (use it through `useDoor()`), chosen by
 * `NUXT_PUBLIC_API_MODE`, loading only the adapter it names.
 *
 * `$doorDemo` lists demo tickets to scan, and exists only in mock mode, where
 * there are no real tickets to point a camera at.
 */
export default defineNuxtPlugin({
  name: 'door',
  async setup() {
    const config = useRuntimeConfig().public
    let door: DoorApi
    let doorDemo: ((session: SessionRef) => DemoTicket[]) | null = null

    switch (config.apiMode) {
      case 'firebase': {
        const [{ createFirebaseClient }, { createFirebaseDoorApi }] = await Promise.all([
          import('@afriff/firebase'),
          import('@afriff/api/firebase/door'),
        ])
        door = createFirebaseDoorApi(createFirebaseClient({ ...config.firebase }))
        break
      }
      case 'mock': {
        const { createMockDoorApi } = await import('@afriff/api/mock/door')
        const mock = createMockDoorApi({ latency: Number(config.mockLatency) || 0 })
        door = mock
        doorDemo = mock.demoTickets
        break
      }
      default:
        throw new Error(`Unknown NUXT_PUBLIC_API_MODE "${config.apiMode}". Use "mock" or "firebase".`)
    }

    return { provide: { door, doorDemo } }
  },
})

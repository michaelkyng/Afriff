import { createMockApi } from '@afriff/api/mock'
import type { AttendeeApi } from '@afriff/api'

/**
 * Provides the API adapter as `$api` (use it through `useApi()`).
 * Only the mock adapter exists in the frontend-only phase.
 */
export default defineNuxtPlugin({
  name: 'api',
  setup() {
    const config = useRuntimeConfig().public

    let api: AttendeeApi
    switch (config.apiMode) {
      case 'mock':
      default:
        api = createMockApi({ latency: Number(config.mockLatency) || 0 })
    }

    return { provide: { api } }
  },
})

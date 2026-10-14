import type { OpsApi } from '@afriff/api/ops'

/** Provides the Ops API as `$ops` (use it through `useOps()`), loading only the adapter `NUXT_PUBLIC_API_MODE` names. */
export default defineNuxtPlugin({
  name: 'ops',
  async setup() {
    const config = useRuntimeConfig().public
    let ops: OpsApi
    switch (config.apiMode) {
      case 'firebase': {
        const [{ createFirebaseClient }, { createFirebaseOpsApi }] = await Promise.all([
          import('@afriff/firebase'),
          import('@afriff/api/firebase/ops'),
        ])
        ops = createFirebaseOpsApi(createFirebaseClient({ ...config.firebase }))
        break
      }
      case 'mock': {
        const { createMockOpsApi } = await import('@afriff/api/mock/ops')
        ops = createMockOpsApi({ latency: Number(config.mockLatency) || 0 })
        break
      }
      default:
        throw new Error(`Unknown NUXT_PUBLIC_API_MODE "${config.apiMode}". Use "mock" or "firebase".`)
    }
    return { provide: { ops } }
  },
})

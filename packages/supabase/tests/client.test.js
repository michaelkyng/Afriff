import { describe, expect, test } from 'bun:test'
import { createBrowserClient } from '../src/index'

describe('browser client configuration', () => {
  test('rejects server secrets and legacy keys before SDK initialization', () => {
    for (const publishableKey of ['', 'sb_secret_do-not-expose', 'legacy-jwt']) {
      expect(() => createBrowserClient({ url: 'https://example.supabase.co', publishableKey }))
        .toThrow('publishable key')
    }
  })

  test('rejects missing URLs and unsupported protocols', () => {
    for (const url of ['', 'not-a-url', 'file:///tmp/database']) {
      expect(() => createBrowserClient({ url, publishableKey: 'sb_publishable_test' }))
        .toThrow('HTTP(S) project URL')
    }
  })

  test('creates a typed SDK client without connecting or requiring app globals', async () => {
    const client = createBrowserClient({
      url: ' http://127.0.0.1:54321 ',
      publishableKey: ' sb_publishable_test ',
    })
    expect(typeof client.from).toBe('function')
    expect(typeof client.auth.getSession).toBe('function')
    await client.auth.stopAutoRefresh()
  })
})

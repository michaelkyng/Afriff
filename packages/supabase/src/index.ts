import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

export type { Database, Json } from './database.types'

export interface BrowserClientConfig {
  url: string
  /** Use the project's sb_publishable_ key; never a server secret. */
  publishableKey: string
}

/**
 * Call once from an app's client-only plugin and inject into its API adapter.
 * No environment reads or global client: apps own configuration and lifecycle.
 * Server/SSR clients need a separate, request-scoped integration.
 */
export function createBrowserClient(config: BrowserClientConfig) {
  const url = config.url.trim()
  const publishableKey = config.publishableKey.trim()

  if (!URL.canParse(url) || !['http:', 'https:'].includes(new URL(url).protocol)) {
    throw new Error('Supabase requires a valid HTTP(S) project URL.')
  }
  if (!publishableKey.startsWith('sb_publishable_')) {
    throw new Error('The browser client requires a Supabase publishable key (sb_publishable_).')
  }

  return createClient<Database>(url, publishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
    },
  })
}

export type AfriffSupabaseClient = ReturnType<typeof createBrowserClient>

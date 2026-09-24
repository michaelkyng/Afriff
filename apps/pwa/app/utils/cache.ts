import type { NuxtApp } from '#app'

/**
 * `getCachedData` for anything fetched once and shared under one key.
 *
 * A screen that mounts reuses what is already loaded, but an explicit refresh
 * (`refresh()`, `refreshNuxtData`) always goes back to the API. Nuxt asks this
 * on every fetch, refreshes included, so answering from the payload every time
 * would quietly turn each refresh into a no-op.
 */
export function reuseLoaded<T>(key: string, nuxtApp: NuxtApp, context: { cause: string }): T | undefined {
  if (context.cause === 'refresh:manual' || context.cause === 'refresh:hook') return undefined
  return (nuxtApp.payload.data[key] ?? nuxtApp.static.data[key]) as T | undefined
}

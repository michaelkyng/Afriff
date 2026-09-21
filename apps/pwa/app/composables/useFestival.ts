/**
 * Shared festival data (edition, dates, days). Cached under one key so every
 * page and component reuses the same request.
 */
export function useFestival() {
  const api = useApi()
  return useLazyAsyncData('festival', () => api.festival.get(), {
    getCachedData: (key, nuxtApp) => nuxtApp.payload.data[key] ?? nuxtApp.static.data[key],
  })
}

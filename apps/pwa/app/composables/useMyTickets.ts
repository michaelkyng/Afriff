/**
 * The attendee's tickets, fetched once and shared under one key.
 *
 * Three screens want them — My tickets, My festival and the updates banner —
 * and none of them should trigger a second call. Nothing is fetched until
 * someone asks with `ensure()`, and signing out empties the list rather than
 * leaving one attendee's tickets on screen for the next.
 */
/** One sign-in watcher per app, however many screens ask for the tickets. */
const watched = new WeakSet<object>()

export function useMyTickets() {
  const api = useApi()
  const nuxtApp = useNuxtApp()
  const { isSignedIn } = useAuth()

  const result = useLazyAsyncData('tickets:mine', () => api.tickets.list(), {
    immediate: false,
    default: () => [],
  })

  /** Fetches on the first ask, and after a sign-in that happened since. */
  function ensure() {
    if (!isSignedIn.value) return
    if (result.status.value === 'idle') result.refresh()
  }

  if (!watched.has(nuxtApp)) {
    watched.add(nuxtApp)
    // Detached, so it outlives whichever component happened to ask first.
    effectScope(true).run(() => {
      watch(isSignedIn, (signedIn) => {
        if (signedIn) result.refresh()
        else result.data.value = []
      })
    })
  }

  return {
    tickets: result.data,
    status: result.status,
    error: result.error,
    refresh: result.refresh,
    /** A lazy fetch reports idle before pending, so success or error is what settles it. */
    loading: computed(() => result.status.value !== 'success' && result.status.value !== 'error'),
    ensure,
  }
}

/**
 * The attendee's tickets, shared under one key.
 *
 * Several places want them. The badge and the updates banner only need them
 * loaded once, so they `ensure()`. My tickets and My festival are about the
 * tickets themselves, so they `revalidate()` each time they open. Anything that
 * changes a ticket refreshes the key through `useAccountRefresh`. Signing out
 * empties the list rather than leaving one attendee's tickets on screen for the
 * next.
 */
/** One sign-in watcher per app, however many screens ask for the tickets. */
const watched = new WeakSet<object>()

export function useMyTickets() {
  const api = useApi()
  const nuxtApp = useNuxtApp()
  const { isSignedIn } = useAuth()

  // No default: "not loaded yet" has to look different from "no tickets".
  const result = useLazyAsyncData('tickets:mine', () => api.tickets.list(), { immediate: false })

  /** Fetches on the first ask, and after a sign-in that happened since. */
  function ensure() {
    if (!isSignedIn.value) return
    if (result.status.value === 'idle') result.refresh()
  }

  /** Fetches again now. What is already loaded stays on screen until the new list lands. */
  function revalidate() {
    if (isSignedIn.value) result.refresh()
  }

  if (!watched.has(nuxtApp)) {
    watched.add(nuxtApp)
    // Detached, so it outlives whichever component happened to ask first.
    effectScope(true).run(() => {
      watch(isSignedIn, (signedIn) => {
        if (signedIn) result.refresh()
        else result.clear()
      })
    })
  }

  return {
    tickets: result.data,
    status: result.status,
    error: result.error,
    refresh: result.refresh,
    /** Only true before the first list arrives, so a background refresh does not blank the screen. */
    loading: computed(() => result.data.value === undefined && result.status.value !== 'error'),
    ensure,
    revalidate,
  }
}

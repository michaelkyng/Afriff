/**
 * What an order or a ticket changing on the server leaves stale: the attendee's
 * tickets (My tickets, My festival, the updates banner and badge), their orders
 * on Me, and the stock left on sale.
 */
const ACCOUNT_KEYS = ['tickets:mine', 'me:orders', 'catalog:products']

/**
 * Call after anything that places, pays for or moves a ticket. Whatever is on
 * screen fetches again; screens that are not open fetch their own on the way in.
 *
 * Returns a function rather than refreshing directly so it can still be called
 * after an `await` or a navigation, once the calling component is gone.
 */
export function useAccountRefresh() {
  const nuxtApp = useNuxtApp()
  return () => nuxtApp.runWithContext(() => refreshNuxtData(ACCOUNT_KEYS))
}

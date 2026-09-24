import type { TicketProduct } from '@afriff/api'

/**
 * The ticket catalogue. Cached under one key like the programme, and refreshed
 * after anything that takes or gives back stock (`useAccountRefresh`) so what is
 * left stays honest.
 */
export function useCatalog() {
  const api = useApi()
  const result = useLazyAsyncData('catalog:products', () => api.catalog.listProducts(), {
    getCachedData: reuseLoaded,
  })
  // Stock moves, so a screen that opens on a cached catalogue checks it again
  // in the background rather than trusting what was left last time.
  if (result.data.value) result.refresh()
  return result
}

/** Products keep their price in kobo; this is the lowest of them, for "From ₦x". */
export function lowestPrice(products: TicketProduct[] | null | undefined): string | undefined {
  const prices = (products ?? []).map((product) => product.price.amount)
  return prices.length ? formatMoney({ amount: Math.min(...prices), currency: 'NGN' }) : undefined
}

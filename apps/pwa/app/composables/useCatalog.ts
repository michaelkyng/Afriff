import type { TicketProduct } from '@afriff/api'

/**
 * The ticket catalogue. Cached under one key like the programme, and refreshed
 * after a checkout so remaining stock stays honest.
 */
export function useCatalog() {
  const api = useApi()
  return useLazyAsyncData('catalog:products', () => api.catalog.listProducts(), {
    getCachedData: (key, nuxtApp) => nuxtApp.payload.data[key] ?? nuxtApp.static.data[key],
  })
}

/** Products keep their price in kobo; this is the lowest of them, for "From ₦x". */
export function lowestPrice(products: TicketProduct[] | null | undefined): string | undefined {
  const prices = (products ?? []).map((product) => product.price.amount)
  return prices.length ? formatMoney({ amount: Math.min(...prices), currency: 'NGN' }) : undefined
}

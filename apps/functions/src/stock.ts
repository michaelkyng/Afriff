import type { StockLevels } from '@afriff/api/orders'

/**
 * Live stock from what a transaction just read, kept apart from Firestore so it
 * can be tested on its own. A product's `remaining: null` means "not limited",
 * and must stay null through the lookup: only a product that was not read at
 * all (or no longer exists) counts as none left.
 */
export function stockLevels(
  products: ReadonlyMap<string, { remaining: number | null } | undefined>,
  screenings: ReadonlyMap<string, { capacity: number; sold: number } | undefined>,
): StockLevels {
  return {
    remaining(productId) {
      const product = products.get(productId)
      return product ? product.remaining : 0
    },
    seatsLeft(screeningId) {
      const screening = screenings.get(screeningId)
      return screening ? Math.max(0, screening.capacity - screening.sold) : 0
    },
  }
}

import type { Money, TicketSelection } from '@afriff/api'

export interface CartLine {
  /** Product plus selection: adding the same thing twice adds to one line. */
  key: string
  productId: string
  quantity: number
  selection?: TicketSelection
  /** Kept for display, so the cart reads correctly offline. The API recomputes both. */
  title: string
  detail?: string
  productName: string
  unitPrice: Money
}

export function cartKey(productId: string, selection?: TicketSelection): string {
  const parts = [selection?.day, selection?.screeningId, selection?.eventId].filter(Boolean)
  return parts.length ? `${productId}:${parts.join(':')}` : productId
}

/** The cart lives on the device until checkout, under `afriff:cart`. */
export const useCartStore = defineStore(
  'cart',
  () => {
    const lines = ref<CartLine[]>([])

    const count = computed(() => lines.value.reduce((sum, line) => sum + line.quantity, 0))
    const isEmpty = computed(() => lines.value.length === 0)
    const subtotal = computed<Money>(() => ({
      amount: lines.value.reduce((sum, line) => sum + line.unitPrice.amount * line.quantity, 0),
      currency: 'NGN',
    }))

    function add(line: Omit<CartLine, 'key'>, max: number) {
      const key = cartKey(line.productId, line.selection)
      const existing = lines.value.find((item) => item.key === key)
      if (existing) existing.quantity = Math.min(max, existing.quantity + line.quantity)
      else lines.value.push({ ...line, key })
    }

    function setQuantity(key: string, quantity: number) {
      const line = lines.value.find((item) => item.key === key)
      if (!line) return
      if (quantity <= 0) remove(key)
      else line.quantity = quantity
    }

    function remove(key: string) {
      lines.value = lines.value.filter((line) => line.key !== key)
    }

    function clear() {
      lines.value = []
    }

    /** What checkout sends: the API works out prices and titles for itself. */
    function toCheckoutItems() {
      return lines.value.map((line) => ({
        productId: line.productId,
        quantity: line.quantity,
        selection: line.selection,
      }))
    }

    return { lines, count, isEmpty, subtotal, add, setQuantity, remove, clear, toCheckoutItems }
  },
  { persist: true },
)

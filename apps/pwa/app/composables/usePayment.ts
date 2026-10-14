import type { Order, PaymentIntent } from '@afriff/api'
import type { MockPaymentOutcome } from '@afriff/api/mock'

/**
 * The stand-in checkout that is open, if any, and how to close it. One per app:
 * the sheet in the default layout shows it, whichever page started the payment.
 */
const mockCheckout = shallowRef<{ intent: PaymentIntent; close: () => void } | null>(null)

/**
 * Taking payment for an order the server has opened (`PaymentIntent`).
 *
 * The app shows the provider's checkout and waits for the attendee to finish
 * with it, however that went. It never decides the outcome: `pay` always ends by
 * asking the server, which asks Paystack. A "success" from the browser is only a
 * hint to go and check.
 */
export function usePayment() {
  const api = useApi()
  const { $mockGateway } = useNuxtApp()

  /** Paystack's inline checkout, loaded only when someone pays. */
  async function paystackCheckout(intent: PaymentIntent): Promise<void> {
    const { default: PaystackPop } = await import('@paystack/inline-js')
    await new Promise<void>((resolve, reject) => {
      new PaystackPop().resumeTransaction(intent.accessCode, {
        onSuccess: () => resolve(),
        onCancel: () => resolve(),
        onError: (error) => reject(new Error(error?.message || 'Paystack’s checkout could not load.')),
      })
    })
  }

  function standInCheckout(intent: PaymentIntent): Promise<void> {
    return new Promise((resolve) => {
      mockCheckout.value = { intent, close: resolve }
    })
  }

  /**
   * Opens the checkout for the intent and returns the order as the server sees it
   * once the attendee is done: paid, still waiting, or failed.
   */
  async function pay(intent: PaymentIntent): Promise<Order> {
    if (intent.provider === 'mock') {
      await standInCheckout(intent)
    }
    else {
      try {
        await paystackCheckout(intent)
      }
      catch {
        // The in-app checkout would not load (blocked, or the script failed). Paystack's
        // own page still works, and sends the attendee back to the order, which checks on arrival.
        window.location.assign(intent.authorizationUrl)
        return new Promise<never>(() => {})
      }
    }
    return api.orders.verify(intent.orderId)
  }

  /** For the stand-in checkout sheet: what the attendee chose, or nothing when they closed it. */
  function finishMock(outcome: MockPaymentOutcome | null) {
    const open = mockCheckout.value
    if (!open) return
    mockCheckout.value = null
    if (outcome) $mockGateway?.complete(open.intent.reference, outcome)
    open.close()
  }

  return { pay, mockCheckout: readonly(mockCheckout), finishMock }
}

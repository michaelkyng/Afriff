import { ApiError } from '../contract'
import type { Money, PaymentChannel, PaymentIntent } from '../types'
import { mockDb } from './db'

/**
 * A stand-in for Paystack, so the local build goes through the same steps as the
 * real one: the server opens a transaction, the attendee pays in the provider's
 * checkout, and the server asks the provider how it went.
 *
 * The app's mock checkout sheet plays the attendee's part through `complete`.
 * The mock orders service plays the server's through `open` and `verify`.
 */

export type MockPaymentOutcome = 'success' | 'failed'

/** The part the app's mock checkout sheet uses. */
export interface MockGateway {
  /** Records what the attendee did in the stand-in checkout. Closing it without choosing leaves it open. */
  complete(reference: string, outcome: MockPaymentOutcome): void
}

/** Paystack's transaction statuses that matter here. */
export type MockTransactionStatus = 'ongoing' | 'success' | 'failed'

export interface MockTransaction {
  reference: string
  accessCode: string
  amount: Money
  email: string
  status: MockTransactionStatus
  channel?: PaymentChannel
  last4?: string
  cardBrand?: string
  /** Written the way Paystack's `gateway_response` is. */
  gatewayResponse?: string
}

export interface MockPaymentProvider {
  gateway: MockGateway
  open(input: { orderId: string; reference: string; amount: Money; email: string }): PaymentIntent
  /** Resumes a transaction that is still open, the way Paystack lets an access code be used again. */
  resume(orderId: string, reference: string): PaymentIntent | undefined
  verify(reference: string): MockTransaction | undefined
}

export function createMockPayments(): MockPaymentProvider {
  const transactions: MockTransaction[] = mockDb.read<MockTransaction[]>('payments', [])
  const persist = () => mockDb.write('payments', transactions)
  const find = (reference: string) => transactions.find((item) => item.reference === reference)

  const intentOf = (orderId: string, transaction: MockTransaction): PaymentIntent => ({
    orderId,
    provider: 'mock',
    reference: transaction.reference,
    accessCode: transaction.accessCode,
    authorizationUrl: `mock://checkout/${transaction.accessCode}`,
    amount: transaction.amount,
    email: transaction.email,
  })

  return {
    gateway: {
      complete(reference, outcome) {
        const transaction = find(reference)
        if (!transaction) throw new ApiError('not_found', 'That payment is not open any more.', { reference })
        if (transaction.status !== 'ongoing') return
        if (outcome === 'success') {
          // Paystack's test card ends in 4081, so the demo reads like a real receipt.
          Object.assign(transaction, { status: 'success', channel: 'card', last4: '4081', cardBrand: 'visa', gatewayResponse: 'Approved' })
        }
        else {
          Object.assign(transaction, { status: 'failed', channel: 'card', gatewayResponse: 'Declined' })
        }
        persist()
      },
    },

    open({ orderId, reference, amount, email }) {
      const transaction: MockTransaction = {
        reference,
        accessCode: `mock_${reference.toLowerCase()}`,
        amount,
        email,
        status: 'ongoing',
      }
      transactions.push(transaction)
      persist()
      return intentOf(orderId, transaction)
    },

    resume(orderId, reference) {
      const transaction = find(reference)
      return transaction?.status === 'ongoing' ? intentOf(orderId, transaction) : undefined
    },

    verify: (reference) => {
      const transaction = find(reference)
      return transaction ? { ...transaction } : undefined
    },
  }
}

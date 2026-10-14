import { logger } from 'firebase-functions'
import { onRequest } from 'firebase-functions/https'
import { collections } from './admin'
import { PAYSTACK_SECRET_KEY } from './env'
import { settle } from './orders'
import { hasValidSignature, orderIdOf } from './paystack'
import type { PaystackTransaction } from './paystack'

/**
 * Paystack tells us about payments here, whether or not the attendee's app is
 * still open. Point the dashboard's webhook URL at this function (see
 * `firebase/README.md`).
 *
 * Only signed requests are read. A 200 tells Paystack the event is handled; any
 * other answer makes it retry, which is safe because `settle` is idempotent.
 */
export const paystackWebhook = onRequest(
  { secrets: [PAYSTACK_SECRET_KEY], invoker: 'public', cors: false },
  async (request, response) => {
    if (request.method !== 'POST') {
      response.status(405).send('Method not allowed')
      return
    }
    if (!hasValidSignature(request.rawBody, request.get('x-paystack-signature'), PAYSTACK_SECRET_KEY.value())) {
      logger.warn('Refused a webhook without a valid Paystack signature')
      response.status(401).send('Invalid signature')
      return
    }

    let event: { event?: string; data?: PaystackTransaction }
    try {
      event = JSON.parse(request.rawBody.toString('utf8'))
    }
    catch {
      response.status(400).send('Invalid JSON')
      return
    }

    const transaction = event.data
    const orderId = transaction ? orderIdOf(transaction) : undefined
    try {
      // An audit trail without the card or customer details the payload carries.
      if (transaction?.reference) {
        await collections.paymentEvents().doc(`${event.event ?? 'unknown'}_${transaction.reference}`.replace(/\//g, '_')).set({
          event: event.event ?? 'unknown',
          reference: transaction.reference,
          status: transaction.status,
          amount: transaction.amount,
          orderId: orderId ?? null,
          receivedAt: new Date().toISOString(),
        })
      }
      if (event.event === 'charge.success' && transaction && orderId) {
        await settle(orderId, transaction)
      }
      response.status(200).send('ok')
    }
    catch (error) {
      logger.error('Could not apply a Paystack webhook; Paystack will retry', { event: event.event, orderId, error })
      response.status(500).send('Try again')
    }
  },
)

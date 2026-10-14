import { logger } from 'firebase-functions'
import { FieldValue } from 'firebase-admin/firestore'
import { ApiError } from '@afriff/api'
import type { MailDoc, OrderDoc, PaymentAttempt, TicketDoc } from '@afriff/api/firebase/schema'
import {
  assertAvailable,
  attemptReference,
  demandOf,
  HOLD_EXPIRED_REASON,
  holdExpiry,
  LATE_PAYMENT_REASON,
  MAX_OPEN_ORDERS,
  newId,
  orderTotal,
  paymentChannel,
  paymentFailureReason,
  resolveLine,
  ticketsFor,
  withoutUndefined,
} from '@afriff/api/orders'
import type { Order, PaymentIntent } from '@afriff/api/types'
import { checkoutSchema, orderRefSchema } from '@afriff/validation'
import { collections, db } from './admin'
import { callable, parse } from './callable'
import { loadOrderCatalog, moveStock, readStock } from './catalog'
import { appUrl, PAYSTACK_SECRET_KEY } from './env'
import { orderPaidMail } from './mail/templates'
import { createPaystack, OPEN_STATUSES } from './paystack'
import type { PaystackTransaction } from './paystack'

/**
 * Buying, on the server. The browser never decides a price, a stock level or a
 * payment outcome: it asks for an order, pays in Paystack's checkout, and then
 * asks how it went. Paystack also tells us directly (the webhook), and
 * `settle` is the one place either answer is applied — idempotently, in a
 * transaction, so the two can arrive in any order, more than once.
 */

const paystack = () => createPaystack(PAYSTACK_SECRET_KEY.value())

/** How long past its hold an order may wait on a bank that is still confirming a payment. */
const IN_FLIGHT_GRACE_MS = 2 * 60 * 60 * 1000

const now = () => new Date().toISOString()

/** The order as the app sees it. */
export function toOrder({ userId: _u, holds: _h, attempts: _a, refundDue: _r, duplicatePayments: _d, updatedAt: _t, ...order }: OrderDoc): Order {
  return order
}

async function ownOrder(orderId: string, uid: string): Promise<OrderDoc> {
  const order = (await collections.orders().doc(orderId).get()).data() as OrderDoc | undefined
  if (!order || order.userId !== uid) throw new ApiError('not_found', 'We could not find that order.', { orderId })
  return order
}

function intentFrom(order: OrderDoc, attempt: PaymentAttempt): PaymentIntent {
  return {
    orderId: order.id,
    provider: 'paystack',
    reference: attempt.reference,
    accessCode: attempt.accessCode,
    authorizationUrl: attempt.authorizationUrl,
    amount: order.total,
    email: order.contact.email,
  }
}

/**
 * Opens a new Paystack transaction for an order that is holding its stock. If
 * Paystack cannot be reached the order gives its stock back at once, rather
 * than sitting on it until the hold runs out.
 */
async function openAttempt(order: OrderDoc): Promise<PaymentIntent> {
  const reference = attemptReference(order.reference, order.attempts.length + 1)
  const ref = collections.orders().doc(order.id)
  let opened: { authorizationUrl: string; accessCode: string }
  try {
    opened = await paystack().initialize({
      email: order.contact.email,
      amount: order.total.amount,
      reference,
      callbackUrl: `${appUrl()}/orders/${order.id}`,
      metadata: { orderId: order.id, userId: order.userId },
    })
  }
  catch (error) {
    logger.error('Paystack would not open a transaction', { orderId: order.id, reference, error })
    await failOrder(order.id, 'We could not reach the payment provider, so nothing was charged. Try again in a moment.')
    throw new ApiError('network', 'We could not reach the payment provider. Nothing was charged; try again in a moment.')
  }
  const attempt: PaymentAttempt = { reference, ...opened, openedAt: now() }
  await ref.update({ attempts: FieldValue.arrayUnion(attempt), 'payment.reference': reference, updatedAt: now() })
  return intentFrom(order, attempt)
}

/** Gives the stock back and marks the order failed, if it is still waiting. */
async function failOrder(orderId: string, reason: string, onlyIfExpired = false): Promise<void> {
  const ref = collections.orders().doc(orderId)
  const before = (await ref.get()).data() as OrderDoc | undefined
  if (!before) return
  const catalog = await loadOrderCatalog(before.lines)
  await db.runTransaction(async (tx) => {
    const order = (await tx.get(ref)).data() as OrderDoc | undefined
    if (!order || order.status !== 'pending') return
    if (onlyIfExpired && order.holdExpiresAt && order.holdExpiresAt > now()) return
    if (order.holds) moveStock(tx, demandOf(order.lines), catalog, 'release')
    tx.update(ref, {
      status: 'failed',
      holds: false,
      holdExpiresAt: FieldValue.delete(),
      'payment.failureReason': reason,
      updatedAt: now(),
    })
  })
}

/**
 * Applies what Paystack says about one attempt. Safe to call any number of times
 * and from anywhere: the webhook, `verifyOrder`, `payOrder` and the expiry job.
 *
 * - Success: tickets are issued, one per seat, and the confirmation email is
 *   queued in the same transaction. If the hold had lapsed, the stock is taken
 *   again; if it is gone, the order is flagged for a refund instead.
 * - Failure of the latest attempt: the stock goes back.
 * - Anything else (still open): nothing changes.
 */
export async function settle(orderId: string, transaction: PaystackTransaction): Promise<OrderDoc> {
  const ref = collections.orders().doc(orderId)
  const before = (await ref.get()).data() as OrderDoc | undefined
  if (!before) throw new ApiError('not_found', 'We could not find that order.', { orderId })
  const catalog = await loadOrderCatalog(before.lines)

  await db.runTransaction(async (tx) => {
    const order = (await tx.get(ref)).data() as OrderDoc
    if (!order.attempts.some((attempt) => attempt.reference === transaction.reference)) {
      logger.warn('A transaction that was not opened for this order', { orderId, reference: transaction.reference })
      return
    }
    const at = now()
    const demand = demandOf(order.lines)

    if (transaction.status === 'success') {
      if (order.status === 'paid') {
        if (transaction.reference !== order.payment.reference && !order.duplicatePayments?.includes(transaction.reference)) {
          logger.error('A second payment succeeded on a paid order; refund it', { orderId, reference: transaction.reference })
          tx.update(ref, { duplicatePayments: FieldValue.arrayUnion(transaction.reference), refundDue: true, updatedAt: at })
        }
        return
      }

      if (transaction.amount !== order.total.amount || transaction.currency !== order.total.currency) {
        logger.error('The amount paid does not match the order; refund it', {
          orderId,
          reference: transaction.reference,
          paid: transaction.amount,
          expected: order.total.amount,
        })
        if (order.holds) moveStock(tx, demand, catalog, 'release')
        tx.update(ref, {
          status: 'failed',
          holds: false,
          refundDue: true,
          holdExpiresAt: FieldValue.delete(),
          'payment.failureReason': 'The amount paid did not match the order. We will refund you and be in touch.',
          updatedAt: at,
        })
        return
      }

      if (!order.holds) {
        const stock = await readStock(tx, demand)
        try {
          assertAvailable(demand, catalog, stock)
        }
        catch {
          logger.error('Paid after the hold lapsed and the stock has gone; refund it', { orderId, reference: transaction.reference })
          tx.update(ref, {
            status: 'failed',
            refundDue: true,
            'payment.reference': transaction.reference,
            'payment.failureReason': LATE_PAYMENT_REASON,
            updatedAt: at,
          })
          return
        }
        moveStock(tx, demand, catalog, 'take')
      }

      const tickets = ticketsFor(order, catalog, at)
      for (const ticket of tickets) {
        const doc: TicketDoc = { ...ticket, userId: order.userId }
        tx.create(collections.tickets().doc(ticket.id), doc)
      }
      tx.update(ref, {
        status: 'paid',
        paidAt: transaction.paid_at ?? at,
        holds: true,
        ticketIds: tickets.map((ticket) => ticket.id),
        holdExpiresAt: FieldValue.delete(),
        payment: withoutUndefined({
          provider: 'paystack' as const,
          reference: transaction.reference,
          channel: paymentChannel(transaction.channel),
          last4: transaction.authorization?.last4 ?? undefined,
          cardBrand: (transaction.authorization?.brand ?? transaction.authorization?.card_type ?? undefined)?.trim().toLowerCase(),
        }),
        updatedAt: at,
      })
      const mail: MailDoc = {
        ...orderPaidMail(order, tickets.length),
        status: 'queued',
        attempts: 0,
        createdAt: at,
      }
      tx.create(collections.mail().doc(), mail)
      return
    }

    const lastAttempt = transaction.reference === order.payment.reference
    if ((transaction.status === 'failed' || transaction.status === 'reversed') && order.status === 'pending' && lastAttempt) {
      if (order.holds) moveStock(tx, demand, catalog, 'release')
      tx.update(ref, {
        status: 'failed',
        holds: false,
        holdExpiresAt: FieldValue.delete(),
        'payment.failureReason': paymentFailureReason(transaction.gateway_response),
        updatedAt: at,
      })
    }
  })

  return (await ref.get()).data() as OrderDoc
}

/** Unpaid orders past their hold give their stock back, unless Paystack says the money landed after all. */
export async function expireOrder(order: OrderDoc): Promise<'settled' | 'expired' | 'waiting'> {
  const reference = order.payment.reference
  const transaction = reference ? await paystack().verify(reference).catch(() => null) : null
  if (transaction?.status === 'success') {
    await settle(order.id, transaction)
    return 'settled'
  }
  // A transfer or USSD payment the bank is still confirming gets more time, within reason.
  const overdue = Date.now() - Date.parse(order.holdExpiresAt ?? order.placedAt) > IN_FLIGHT_GRACE_MS
  if (!overdue && transaction && ['pending', 'processing', 'queued'].includes(transaction.status)) return 'waiting'
  await failOrder(order.id, HOLD_EXPIRED_REASON, true)
  return 'expired'
}

// ------------------------------------------------------------------ callables

export const checkout = callable<'checkout'>({ secrets: [PAYSTACK_SECRET_KEY] }, async (data, { uid }) => {
  const input = parse(checkoutSchema, data, 'Check the order and try again.')

  const open = await collections.orders().where('userId', '==', uid).where('status', '==', 'pending').count().get()
  if (open.data().count >= MAX_OPEN_ORDERS) {
    throw new ApiError('conflict', 'You have unpaid orders waiting. Pay for one, or let it lapse, before starting another.')
  }

  const catalog = await loadOrderCatalog(input.items)
  const lines = input.items.map((item) => resolveLine(item, catalog))
  const demand = demandOf(lines)
  const placedAt = new Date()
  const order: OrderDoc = {
    id: newId.order(),
    reference: newId.orderReference(),
    userId: uid,
    status: 'pending',
    placedAt: placedAt.toISOString(),
    holdExpiresAt: holdExpiry(placedAt),
    lines,
    total: orderTotal(lines),
    contact: withoutUndefined({ ...input.contact, phone: input.contact.phone || undefined }),
    payment: { provider: 'paystack' },
    ticketIds: [],
    holds: true,
    attempts: [],
    updatedAt: placedAt.toISOString(),
  }

  // Check and take the stock in one go, so two attendees cannot buy the last seat.
  await db.runTransaction(async (tx) => {
    assertAvailable(demand, catalog, await readStock(tx, demand))
    moveStock(tx, demand, catalog, 'take')
    tx.create(collections.orders().doc(order.id), order)
  })

  return openAttempt(order)
})

export const payOrder = callable<'payOrder'>({ secrets: [PAYSTACK_SECRET_KEY] }, async (data, { uid }) => {
  const { orderId } = parse(orderRefSchema, data, 'Which order?')
  let order = await ownOrder(orderId, uid)
  const alreadyPaid = () => new ApiError('conflict', 'That order is already paid.', { orderId })
  if (order.status === 'paid') throw alreadyPaid()

  // While the latest attempt is still open, carry on with it rather than risk paying twice.
  const latest = order.attempts.at(-1)
  if (order.status === 'pending' && latest) {
    const transaction = await paystack().verify(latest.reference).catch(() => null)
    if (!transaction) return intentFrom(order, latest)
    order = await settle(orderId, transaction)
    if (order.status === 'paid') throw alreadyPaid()
    if (order.status === 'pending' && OPEN_STATUSES.includes(transaction.status)) return intentFrom(order, latest)
  }

  // A fresh attempt. A failed order gave its stock back, so it has to be there still.
  const ref = collections.orders().doc(orderId)
  const catalog = await loadOrderCatalog(order.lines)
  await db.runTransaction(async (tx) => {
    const current = (await tx.get(ref)).data() as OrderDoc
    if (current.status === 'paid') throw alreadyPaid()
    const demand = demandOf(current.lines)
    if (!current.holds) {
      assertAvailable(demand, catalog, await readStock(tx, demand))
      moveStock(tx, demand, catalog, 'take')
    }
    tx.update(ref, {
      status: 'pending',
      holds: true,
      holdExpiresAt: holdExpiry(),
      'payment.failureReason': FieldValue.delete(),
      updatedAt: now(),
    })
  })
  return openAttempt((await ref.get()).data() as OrderDoc)
})

export const verifyOrder = callable<'verifyOrder'>({ secrets: [PAYSTACK_SECRET_KEY] }, async (data, { uid }) => {
  const { orderId } = parse(orderRefSchema, data, 'Which order?')
  const order = await ownOrder(orderId, uid)
  const reference = order.payment.reference
  if (order.status === 'paid' || !reference) return toOrder(order)
  let transaction: PaystackTransaction
  try {
    transaction = await paystack().verify(reference)
  }
  catch (error) {
    logger.warn('Could not verify with Paystack', { orderId, reference, error })
    throw new ApiError('network', 'We could not reach the payment provider to check. Try again in a moment.')
  }
  return toOrder(await settle(orderId, transaction))
})

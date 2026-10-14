import { ApiError } from '@afriff/api'
import { formatMoney } from '@afriff/api/format'
import type { MailDoc, OrderDoc, TicketDoc } from '@afriff/api/firebase/schema'
import type { MarkRefundedInput, OpsOrder, OpsTicket, ReissueTicketInput, ResendOrderEmailInput, UpdateProductInput, VoidTicketInput } from '@afriff/api/ops'
import { newId } from '@afriff/api/orders'
import type { TicketProduct } from '@afriff/api/types'
import { collections, db } from '../admin'
import { orderPaidMail } from '../mail/templates'
import { audit, withoutPosition } from './context'
import type { Who } from './context'

const notFound = (what: string, id: string) => new ApiError('not_found', `We could not find that ${what}.`, { id })

/** Price, stock left and per-order limit. In a transaction, so a sale at the same moment is not lost. */
export async function updateProduct(input: UpdateProductInput, who: Who): Promise<TicketProduct> {
  const ref = collections.products().doc(input.productId)
  return db.runTransaction(async (tx) => {
    const product = (await tx.get(ref)).data() as (TicketProduct & { position?: number }) | undefined
    if (!product) throw notFound('product', input.productId)
    const next = {
      price: { amount: input.priceNaira * 100, currency: 'NGN' as const },
      remaining: input.remaining,
      maxPerOrder: input.maxPerOrder,
    }
    tx.update(ref, next)
    const changes = [
      product.price.amount !== next.price.amount && `price ${formatMoney(product.price)} to ${formatMoney(next.price)}`,
      product.remaining !== next.remaining && `stock ${product.remaining ?? 'unlimited'} to ${next.remaining ?? 'unlimited'}`,
      product.maxPerOrder !== next.maxPerOrder && `limit ${product.maxPerOrder} to ${next.maxPerOrder} per order`,
    ].filter(Boolean)
    audit(tx, who, 'updateProduct', `${product.name}: ${changes.join(', ') || 'no change'}`, { kind: 'product', id: product.id },
      { before: { price: product.price, remaining: product.remaining, maxPerOrder: product.maxPerOrder }, after: next })
    return withoutPosition({ ...product, ...next })
  })
}

export async function resendOrderEmail(input: ResendOrderEmailInput, who: Who): Promise<{ queued: true }> {
  const order = (await collections.orders().doc(input.orderId).get()).data() as OrderDoc | undefined
  if (!order) throw notFound('order', input.orderId)
  if (order.status !== 'paid') throw new ApiError('conflict', 'Only a paid order has a confirmation to send.')
  const batch = db.batch()
  const mail: MailDoc = { ...orderPaidMail(order, order.ticketIds.length), status: 'queued', attempts: 0, createdAt: who.now.toISOString() }
  batch.create(collections.mail().doc(), mail)
  audit(batch, who, 'resendOrderEmail', `Resent the confirmation for ${order.reference} to ${order.contact.email}`, { kind: 'order', id: order.id })
  await batch.commit()
  return { queued: true }
}

const toTicket = (doc: TicketDoc): OpsTicket => doc

export async function voidTicket(input: VoidTicketInput, who: Who): Promise<OpsTicket> {
  const ref = collections.tickets().doc(input.ticketId)
  return db.runTransaction(async (tx) => {
    const ticket = (await tx.get(ref)).data() as TicketDoc | undefined
    if (!ticket) throw notFound('ticket', input.ticketId)
    if (ticket.status !== 'valid') throw new ApiError('conflict', `That ticket is ${ticket.status === 'used' ? 'already used' : ticket.status === 'void' ? 'already void' : 'passed on'}.`)
    const orderRef = collections.orders().doc(ticket.orderId)
    tx.update(ref, { status: 'void', voidReason: input.reason })
    if (input.refund) tx.update(orderRef, { refundDue: true, refundReason: `Ticket ${ticket.code} voided: ${input.reason}`, updatedAt: who.now.toISOString() })
    audit(tx, who, 'voidTicket', `Voided ${ticket.code} (${ticket.holderName}, ${ticket.title})${input.refund ? ' and flagged a refund' : ''}: ${input.reason}`, { kind: 'ticket', id: ticket.id })
    return toTicket({ ...ticket, status: 'void', voidReason: input.reason })
  })
}

/**
 * A new code for a ticket whose code got out (a screenshot shared, a phone
 * stolen): the old one stops admitting anyone, the holder keeps their seat.
 */
export async function reissueTicket(input: ReissueTicketInput, who: Who): Promise<OpsTicket> {
  const ref = collections.tickets().doc(input.ticketId)
  return db.runTransaction(async (tx) => {
    const old = (await tx.get(ref)).data() as TicketDoc | undefined
    if (!old) throw notFound('ticket', input.ticketId)
    if (old.status !== 'valid') throw new ApiError('conflict', 'Only a valid ticket can be reissued.')
    const orderRef = collections.orders().doc(old.orderId)
    const order = (await tx.get(orderRef)).data() as OrderDoc | undefined
    const { voidReason: _voidReason, usedAt: _usedAt, ...rest } = old
    const fresh: TicketDoc = { ...rest, id: newId.ticket(), code: newId.ticketCode(), status: 'valid', issuedAt: who.now.toISOString() }
    tx.update(ref, { status: 'void', voidReason: `Replaced by a new ticket, ${fresh.code}. Use that one.` })
    tx.create(collections.tickets().doc(fresh.id), fresh)
    if (order) tx.update(orderRef, { ticketIds: order.ticketIds.map((id) => (id === old.id ? fresh.id : id)), updatedAt: who.now.toISOString() })
    audit(tx, who, 'reissueTicket', `Reissued ${old.code} as ${fresh.code} (${old.holderName}, ${old.title})`, { kind: 'ticket', id: fresh.id })
    return toTicket(fresh)
  })
}

export async function markRefunded(input: MarkRefundedInput, who: Who): Promise<OpsOrder> {
  const ref = collections.orders().doc(input.orderId)
  return db.runTransaction(async (tx) => {
    const order = (await tx.get(ref)).data() as OrderDoc | undefined
    if (!order) throw notFound('order', input.orderId)
    if (!order.refundDue) throw new ApiError('conflict', 'That order has no refund waiting.')
    const at = who.now.toISOString()
    tx.update(ref, { refundDue: false, refundedAt: at, refundNote: input.note, updatedAt: at })
    audit(tx, who, 'markRefunded', `Marked ${order.reference} refunded: ${input.note}`, { kind: 'order', id: order.id })
    return { ...order, refundDue: false, refundedAt: at, refundNote: input.note }
  })
}

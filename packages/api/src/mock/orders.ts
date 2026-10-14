import { checkoutSchema, ticketTransferSchema } from '@afriff/validation'
import { ApiError, validationError } from '../contract'
import type { AttendeeApi } from '../contract'
import {
  assertAvailable,
  attemptReference,
  catalogFrom,
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
  seatsLeftAt,
  ticketsFor,
  type StockLevels,
} from '../orders'
import type { CheckoutInput, Order, OrderLine, PaymentIntent, Ticket, TicketProduct, TicketTransferInput, User } from '../types'
import { mockDb } from './db'
import type { MockPaymentProvider, MockTransaction } from './payments'
import * as seed from './seed'

/**
 * Orders, payments and tickets for the mock API.
 *
 * It plays the part the Cloud Functions play behind the Firebase adapter: it
 * checks the cart against the catalogue and the programme (with the same rules,
 * from `../orders`), holds stock while the attendee pays, opens the payment with
 * the stand-in provider, and settles the order when asked how it went — tickets
 * when the money landed, stock back when it did not.
 *
 * Orders and tickets belong to the signed-in attendee and are mirrored to
 * localStorage, so a reload keeps them.
 */

type StoredOrder = Order & {
  userId: string
  /** Whether the order is currently holding its stock. */
  holds: boolean
  /** Every reference opened for it, oldest first. */
  attempts: string[]
  /** Set when money landed that could not be turned into tickets. */
  refundDue?: boolean
}

type StoredTicket = Ticket & { userId: string }

interface OrdersState {
  orders: StoredOrder[]
  tickets: StoredTicket[]
  /** Units sold per product and per `screening:<id>`, on top of the seed. */
  sold: Record<string, number>
}

const catalog = catalogFrom(seed)

export interface MockOrders {
  orders: AttendeeApi['orders']
  tickets: AttendeeApi['tickets']
  /** The catalogue with stock sold through the mock API taken off. */
  products(): TicketProduct[]
}

/**
 * @param respond wraps results in the adapter's simulated latency and deep copy.
 * @param requireUser resolves the signed-in attendee, or throws `unauthorized`.
 * @param payments the stand-in for Paystack.
 */
export function createMockOrders(
  respond: <T>(produce: () => T | Promise<T>) => Promise<T>,
  requireUser: () => User,
  payments: MockPaymentProvider,
): MockOrders {
  const state: OrdersState = {
    orders: mockDb.read<OrdersState['orders']>('orders', []),
    tickets: mockDb.read<OrdersState['tickets']>('tickets', []),
    sold: mockDb.read<OrdersState['sold']>('stock', {}),
  }

  const persist = () => {
    mockDb.write('orders', state.orders)
    mockDb.write('tickets', state.tickets)
    mockDb.write('stock', state.sold)
  }

  const stock: StockLevels = {
    remaining(productId) {
      const product = catalog.product(productId)
      if (!product || product.remaining === null) return null
      return Math.max(0, product.remaining - (state.sold[productId] ?? 0))
    },
    seatsLeft(screeningId) {
      const screening = catalog.screening(screeningId)
      if (!screening) return 0
      return seatsLeftAt({ capacity: screening.capacity, sold: screening.sold + (state.sold[`screening:${screeningId}`] ?? 0) })
    },
  }

  function moveStock(lines: OrderLine[], direction: 1 | -1) {
    for (const line of lines) {
      const keys = [line.productId, ...(line.selection?.screeningId ? [`screening:${line.selection.screeningId}`] : [])]
      for (const key of keys) state.sold[key] = Math.max(0, (state.sold[key] ?? 0) + direction * line.quantity)
    }
  }

  const takeStock = (order: StoredOrder) => {
    moveStock(order.lines, 1)
    order.holds = true
  }

  const releaseStock = (order: StoredOrder) => {
    if (order.holds) moveStock(order.lines, -1)
    order.holds = false
  }

  /** Orders and tickets are stored with an owner and bookkeeping; callers never see it. */
  const publicOrder = ({ userId: _u, holds: _h, attempts: _a, refundDue: _r, ...order }: StoredOrder): Order => order
  const publicTicket = ({ userId: _userId, ...ticket }: StoredTicket): Ticket => ticket

  function findOrder(id: string, userId: string) {
    const order = state.orders.find((item) => item.id === id && item.userId === userId)
    if (!order) throw new ApiError('not_found', 'We could not find that order.', { orderId: id })
    return order
  }

  function findTicket(id: string, userId: string) {
    const ticket = state.tickets.find((item) => item.id === id && item.userId === userId)
    if (!ticket) throw new ApiError('not_found', 'We could not find that ticket.', { ticketId: id })
    return ticket
  }

  function openAttempt(order: StoredOrder): PaymentIntent {
    const reference = attemptReference(order.reference, order.attempts.length + 1)
    order.attempts.push(reference)
    order.payment = { provider: 'mock', reference }
    return payments.open({ orderId: order.id, reference, amount: order.total, email: order.contact.email })
  }

  /**
   * What the provider says about the latest attempt, applied to the order. The
   * same steps as `settle` in the Cloud Functions, in the same order.
   */
  function settle(order: StoredOrder, transaction: MockTransaction | undefined) {
    if (!transaction || order.status === 'paid') return
    if (transaction.status === 'success') {
      if (transaction.amount.amount !== order.total.amount) {
        releaseStock(order)
        order.status = 'failed'
        order.payment = { ...order.payment, failureReason: 'The amount paid did not match the order. We will be in touch.' }
        order.refundDue = true
        return
      }
      if (!order.holds) {
        try {
          assertAvailable(demandOf(order.lines), catalog, stock)
          takeStock(order)
        }
        catch {
          order.status = 'failed'
          order.payment = { ...order.payment, failureReason: LATE_PAYMENT_REASON }
          order.refundDue = true
          return
        }
      }
      const issuedAt = new Date().toISOString()
      const tickets = ticketsFor(order, catalog, issuedAt)
      state.tickets.push(...tickets.map((ticket) => ({ ...ticket, userId: order.userId })))
      order.status = 'paid'
      order.paidAt = issuedAt
      order.ticketIds = tickets.map((ticket) => ticket.id)
      delete order.holdExpiresAt
      order.payment = {
        provider: 'mock',
        reference: transaction.reference,
        channel: paymentChannel(transaction.channel),
        last4: transaction.last4,
        cardBrand: transaction.cardBrand,
      }
      return
    }
    if (transaction.status === 'failed' && transaction.reference === order.payment.reference) {
      releaseStock(order)
      order.status = 'failed'
      delete order.holdExpiresAt
      order.payment = { ...order.payment, failureReason: paymentFailureReason(transaction.gatewayResponse) }
    }
  }

  /**
   * Unpaid orders past their hold give their stock back, unless the provider
   * says the money landed after all. The server does this on a schedule; the mock
   * does it whenever it is asked about orders.
   */
  function sweep() {
    const now = new Date().toISOString()
    let changed = false
    for (const order of state.orders) {
      if (order.status !== 'pending' || !order.holdExpiresAt || order.holdExpiresAt > now) continue
      const latest = order.payment.reference ? payments.verify(order.payment.reference) : undefined
      if (latest?.status === 'success') settle(order, latest)
      else {
        releaseStock(order)
        order.status = 'failed'
        delete order.holdExpiresAt
        order.payment = { ...order.payment, failureReason: HOLD_EXPIRED_REASON }
      }
      changed = true
    }
    if (changed) persist()
  }

  /**
   * A ticket sent to someone with no account waits under their email until they
   * have one. Standing in for the claim the server makes once the email is confirmed.
   */
  const parkedId = (email: string) => `email:${email.toLowerCase()}`

  function claimParked(user: User) {
    if (!user.emailVerified) return
    const waiting = state.tickets.filter((ticket) => ticket.userId === parkedId(user.email))
    if (!waiting.length) return
    for (const ticket of waiting) ticket.userId = user.id
    persist()
  }

  return {
    products: () => seed.products.map((product) => ({ ...product, remaining: stock.remaining(product.id) })),

    orders: {
      checkout: (input: CheckoutInput) =>
        respond((): PaymentIntent => {
          const user = requireUser()
          sweep()
          const parsed = checkoutSchema.safeParse(input)
          if (!parsed.success) throw validationError(parsed.error.issues, 'Check the order and try again.')

          const open = state.orders.filter((order) => order.userId === user.id && order.status === 'pending')
          if (open.length >= MAX_OPEN_ORDERS) {
            throw new ApiError('conflict', 'You have unpaid orders waiting. Pay for one, or let it lapse, before starting another.')
          }

          const lines = parsed.data.items.map((item) => resolveLine(item, catalog))
          assertAvailable(demandOf(lines), catalog, stock)
          const placedAt = new Date()
          const order: StoredOrder = {
            id: newId.order(),
            reference: newId.orderReference(),
            userId: user.id,
            status: 'pending',
            placedAt: placedAt.toISOString(),
            holdExpiresAt: holdExpiry(placedAt),
            lines,
            total: orderTotal(lines),
            contact: parsed.data.contact,
            payment: { provider: 'mock' },
            ticketIds: [],
            holds: false,
            attempts: [],
          }
          takeStock(order)
          const intent = openAttempt(order)
          state.orders.push(order)
          persist()
          return intent
        }),

      list: () =>
        respond(() => {
          const user = requireUser()
          sweep()
          return state.orders
            .filter((order) => order.userId === user.id)
            .sort((a, b) => Date.parse(b.placedAt) - Date.parse(a.placedAt))
            .map(publicOrder)
        }),

      get: (id: string) =>
        respond(() => {
          const user = requireUser()
          sweep()
          return publicOrder(findOrder(id, user.id))
        }),

      pay: (orderId: string) =>
        respond((): PaymentIntent => {
          const user = requireUser()
          sweep()
          const order = findOrder(orderId, user.id)
          // Money may have landed since the app last looked.
          if (order.status === 'pending' && order.payment.reference) settle(order, payments.verify(order.payment.reference))
          if (order.status === 'paid') {
            persist()
            throw new ApiError('conflict', 'That order is already paid.', { orderId })
          }
          if (order.status === 'pending' && order.payment.reference) {
            const open = payments.resume(order.id, order.payment.reference)
            if (open) return open
          }
          // A fresh attempt. A failed order gave its stock back, so it has to be there still.
          if (!order.holds) {
            assertAvailable(demandOf(order.lines), catalog, stock)
            takeStock(order)
          }
          order.status = 'pending'
          order.holdExpiresAt = holdExpiry()
          const intent = openAttempt(order)
          persist()
          return intent
        }),

      verify: (orderId: string) =>
        respond(() => {
          const user = requireUser()
          sweep()
          const order = findOrder(orderId, user.id)
          if (order.status !== 'paid' && order.payment.reference) {
            settle(order, payments.verify(order.payment.reference))
            persist()
          }
          return publicOrder(order)
        }),
    },

    tickets: {
      list: () =>
        respond(() => {
          const user = requireUser()
          claimParked(user)
          return state.tickets
            .filter((ticket) => ticket.userId === user.id)
            .sort((a, b) => (a.startsAt ?? '').localeCompare(b.startsAt ?? ''))
            .map(publicTicket)
        }),

      get: (id: string) =>
        respond(() => {
          const user = requireUser()
          claimParked(user)
          return publicTicket(findTicket(id, user.id))
        }),

      transfer: (id: string, input: TicketTransferInput) =>
        respond(() => {
          const user = requireUser()
          const parsed = ticketTransferSchema.safeParse(input)
          if (!parsed.success) throw validationError(parsed.error.issues, 'Check the email address.')
          const { email, name } = parsed.data

          const ticket = findTicket(id, user.id)
          if (ticket.status === 'transferred') {
            throw new ApiError('conflict', 'You have already passed this ticket on.', { ticketId: id })
          }
          if (ticket.status !== 'valid') {
            throw new ApiError('conflict', 'That ticket can no longer be passed on.', { ticketId: id })
          }
          if (email === user.email.toLowerCase()) {
            throw new ApiError('validation', 'That is your own address.', { field: 'email' })
          }
          const ends = ticket.endsAt ?? ticket.startsAt
          if (ends && Date.parse(ends) < Date.now()) {
            throw new ApiError('conflict', 'That screening is over.', { ticketId: id })
          }

          const at = new Date().toISOString()
          state.tickets.push({
            ...ticket,
            id: newId.ticket(),
            code: newId.ticketCode(),
            userId: parkedId(email),
            holderName: name?.trim() || email,
            issuedAt: at,
            transfer: undefined,
            origin: { fromName: user.name, at },
          })

          ticket.status = 'transferred'
          ticket.transfer = { toEmail: email, toName: name?.trim() || undefined, at }
          persist()
          return publicTicket(ticket)
        }),
    },
  }
}

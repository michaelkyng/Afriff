import { checkoutSchema, paymentSchema, ticketTransferSchema } from '@afriff/validation'
import { ApiError } from '../contract'
import type { AttendeeApi } from '../contract'
import { formatDay, formatDateRange, formatTime } from '../format'
import type {
  CheckoutInput,
  Order,
  OrderLine,
  PaymentInput,
  Ticket,
  TicketProduct,
  TicketSelection,
  TicketTransferInput,
  User,
} from '../types'
import { mockDb } from './db'
import * as seed from './seed'

/**
 * Orders, payments and tickets for the mock API.
 *
 * It plays the part the backend and the payment provider will play together:
 * it checks the cart against the catalogue and the programme, holds stock,
 * decides how the payment goes, and issues tickets when money lands. Orders and
 * tickets belong to the signed-in attendee and are mirrored to localStorage, so
 * a reload keeps them.
 *
 * Payment outcomes are deterministic, so every branch can be demonstrated:
 * a card number ending 0000 is declined, one ending 0001 stays pending, any
 * other card is paid at once, and a transfer is pending until it is confirmed.
 */

const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'

interface OrdersState {
  orders: (Order & { userId: string })[]
  tickets: (Ticket & { userId: string })[]
  /** Units sold per product, on top of the seed's `remaining`. */
  sold: Record<string, number>
}

function randomCode(length: number): string {
  const bytes = typeof crypto !== 'undefined' && crypto.getRandomValues
    ? crypto.getRandomValues(new Uint8Array(length))
    : Array.from({ length }, () => Math.floor(Math.random() * 256))
  return Array.from(bytes, (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join('')
}

function fail(issues: { message: string; path: PropertyKey[] }[], fallback: string): never {
  const first = issues[0]
  throw new ApiError('validation', first?.message ?? fallback, { issues, field: first?.path.join('.') })
}

export interface MockOrders {
  orders: AttendeeApi['orders']
  tickets: AttendeeApi['tickets']
  /** The catalogue with stock sold through the mock API taken off. */
  products(): TicketProduct[]
}

/**
 * @param respond wraps results in the adapter's simulated latency and deep copy.
 * @param requireUser resolves the signed-in attendee, or throws `unauthorized`.
 */
export function createMockOrders(
  respond: <T>(produce: () => T | Promise<T>) => Promise<T>,
  requireUser: () => User,
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

  const remainingOf = (product: TicketProduct) =>
    product.remaining === null ? null : Math.max(0, product.remaining - (state.sold[product.id] ?? 0))

  /** Seats left at a screening: the seed's own sales plus anything bought here. */
  function seatsLeft(screeningId: string): number {
    const screening = seed.screenings.find((item) => item.id === screeningId)
    if (!screening) return 0
    return Math.max(0, screening.capacity - screening.sold - (state.sold[`screening:${screeningId}`] ?? 0))
  }

  function venueOf(venueId: string) {
    return seed.venues.find((venue) => venue.id === venueId)
  }

  /**
   * Checks a line against the catalogue and the programme, and describes what was
   * bought. Everything an attendee could get wrong is caught here.
   */
  function resolveLine(input: { productId: string; quantity: number; selection?: TicketSelection }): OrderLine {
    const product = seed.products.find((item) => item.id === input.productId)
    if (!product) throw new ApiError('not_found', 'That ticket is no longer on sale.', { productId: input.productId })

    const selection = input.selection ?? {}
    const line: OrderLine = {
      id: `line_${randomCode(8).toLowerCase()}`,
      productId: product.id,
      productName: product.name,
      kind: product.kind,
      unitPrice: product.price,
      quantity: input.quantity,
      title: product.name,
    }

    switch (product.validity.type) {
      case 'festival': {
        line.detail = formatDateRange(seed.festival.startsAt, seed.festival.endsAt)
        break
      }
      case 'day': {
        const day = seed.festival.days.find((item) => item.date === selection.day)
        if (!day) throw new ApiError('validation', 'Choose which day this pass is for.', { field: 'selection.day' })
        line.selection = { day: day.date }
        line.detail = day.label
        break
      }
      case 'screening': {
        const screening = seed.screenings.find((item) => item.id === selection.screeningId)
        if (!screening) throw new ApiError('validation', 'Choose which screening this ticket is for.', { field: 'selection.screeningId' })
        const film = seed.films.find((item) => item.id === screening.filmId)
        const venue = venueOf(screening.venueId)
        const screen = venue?.screens.find((item) => item.id === screening.screenId)
        line.selection = { screeningId: screening.id }
        line.title = film?.title ?? product.name
        line.detail = `${formatDay(screening.startsAt)}, ${formatTime(screening.startsAt)} · ${venue?.shortName ?? ''}${screen ? `, ${screen.name}` : ''}`
        break
      }
      case 'event': {
        const wanted = product.validity.eventId ?? selection.eventId
        const event = seed.events.find((item) => item.id === wanted)
        if (!event || event.kind !== product.validity.eventKind) {
          throw new ApiError('validation', 'Choose which session this ticket is for.', { field: 'selection.eventId' })
        }
        line.selection = { eventId: event.id }
        line.title = event.title
        line.detail = `${formatDay(event.startsAt)}, ${formatTime(event.startsAt)} · ${venueOf(event.venueId)?.name ?? ''}`
        break
      }
    }

    return line
  }

  /**
   * Limits and stock apply to the whole order, not to one line, so splitting a
   * product across lines cannot get past the per-order cap.
   */
  function assertAvailability(lines: OrderLine[]) {
    const byProduct = new Map<string, number>()
    const byScreening = new Map<string, number>()
    for (const line of lines) {
      byProduct.set(line.productId, (byProduct.get(line.productId) ?? 0) + line.quantity)
      const screeningId = line.selection?.screeningId
      if (screeningId) byScreening.set(screeningId, (byScreening.get(screeningId) ?? 0) + line.quantity)
    }

    for (const [productId, quantity] of byProduct) {
      const product = seed.products.find((item) => item.id === productId)!
      if (quantity > product.maxPerOrder) {
        throw new ApiError('validation', `Up to ${product.maxPerOrder} ${product.name} tickets per order.`, {
          field: 'quantity',
          productId,
        })
      }
      const left = remainingOf(product)
      if (left !== null && quantity > left) {
        throw new ApiError('sold_out', left === 0 ? `${product.name} is sold out.` : `Only ${left} left for ${product.name}.`, {
          productId,
          remaining: left,
        })
      }
    }

    for (const [screeningId, quantity] of byScreening) {
      const left = seatsLeft(screeningId)
      if (quantity > left) {
        throw new ApiError('sold_out', left === 0 ? 'That screening is sold out.' : `Only ${left} seats left at that screening.`, {
          screeningId,
          remaining: left,
        })
      }
    }
  }

  function takeStock(lines: OrderLine[]) {
    for (const line of lines) {
      state.sold[line.productId] = (state.sold[line.productId] ?? 0) + line.quantity
      if (line.selection?.screeningId) {
        const key = `screening:${line.selection.screeningId}`
        state.sold[key] = (state.sold[key] ?? 0) + line.quantity
      }
    }
  }

  function releaseStock(lines: OrderLine[]) {
    for (const line of lines) {
      state.sold[line.productId] = Math.max(0, (state.sold[line.productId] ?? 0) - line.quantity)
      if (line.selection?.screeningId) {
        const key = `screening:${line.selection.screeningId}`
        state.sold[key] = Math.max(0, (state.sold[key] ?? 0) - line.quantity)
      }
    }
  }

  /** The mock payment provider: the card number decides, transfers wait. */
  function settle(order: Order, payment: PaymentInput) {
    const parsed = paymentSchema.safeParse(payment)
    if (!parsed.success) fail(parsed.error.issues, 'Check the payment details.')
    const details = parsed.data

    if (details.method === 'transfer') {
      order.payment = { method: 'transfer', reference: order.reference }
      order.status = 'pending'
      return
    }

    const digits = details.cardNumber.replace(/\s/g, '')
    const last4 = digits.slice(-4)
    if (last4 === '0000') {
      order.payment = { method: 'card', last4, failureReason: 'Your bank declined this payment.' }
      order.status = 'failed'
      return
    }
    if (last4 === '0001') {
      order.payment = { method: 'card', last4, reference: order.reference }
      order.status = 'pending'
      return
    }
    order.payment = { method: 'card', last4, reference: order.reference }
    order.status = 'paid'
  }

  /** Turns a paid order into admissions, one ticket per seat. */
  function issueTickets(order: Order & { userId: string }) {
    if (order.ticketIds.length) return
    for (const line of order.lines) {
      for (let index = 0; index < line.quantity; index += 1) {
        const screening = line.selection?.screeningId
          ? seed.screenings.find((item) => item.id === line.selection?.screeningId)
          : undefined
        const event = line.selection?.eventId
          ? seed.events.find((item) => item.id === line.selection?.eventId)
          : undefined
        const venueId = screening?.venueId ?? event?.venueId
        const venue = venueId ? venueOf(venueId) : undefined
        const ticket: Ticket & { userId: string } = {
          id: `tkt_${randomCode(12).toLowerCase()}`,
          code: `AF-${randomCode(4)}-${randomCode(4)}`,
          userId: order.userId,
          orderId: order.id,
          productId: line.productId,
          productName: line.productName,
          kind: line.kind,
          status: 'valid',
          holderName: order.contact.name,
          title: line.title,
          subtitle: line.detail,
          startsAt: screening?.startsAt ?? event?.startsAt,
          endsAt: screening?.endsAt ?? event?.endsAt,
          venueName: venue?.name,
          venueId: venue?.id,
          roomName: screening ? venue?.screens.find((item) => item.id === screening.screenId)?.name : undefined,
          selection: line.selection,
          issuedAt: new Date().toISOString(),
        }
        state.tickets.push(ticket)
        order.ticketIds.push(ticket.id)
      }
    }
  }

  /** Orders and tickets are stored with an owner; callers never see it. */
  const publicOrder = ({ userId: _userId, ...order }: Order & { userId: string }): Order => order
  const publicTicket = ({ userId: _userId, ...ticket }: Ticket & { userId: string }): Ticket => ticket

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

  /**
   * A ticket sent to someone with no account waits under their email until they
   * have one. Standing in for the invitation email the backend will send.
   */
  const parkedId = (email: string) => `email:${email.toLowerCase()}`

  function claimParked(user: User) {
    const waiting = state.tickets.filter((ticket) => ticket.userId === parkedId(user.email))
    if (!waiting.length) return
    for (const ticket of waiting) ticket.userId = user.id
    persist()
  }

  /** Paid and pending orders hold stock; a failed one gives it back. */
  function applyOutcome(order: Order & { userId: string }, wasHolding: boolean) {
    const holds = order.status !== 'failed'
    if (holds && !wasHolding) takeStock(order.lines)
    if (!holds && wasHolding) releaseStock(order.lines)
    if (order.status === 'paid') {
      order.paidAt = new Date().toISOString()
      issueTickets(order)
    }
    persist()
  }

  return {
    products: () => seed.products.map((product) => ({ ...product, remaining: remainingOf(product) })),

    orders: {
      checkout: (input: CheckoutInput) =>
        respond((): Order => {
          const user = requireUser()
          const parsed = checkoutSchema.safeParse(input)
          if (!parsed.success) fail(parsed.error.issues, 'Check the order and try again.')

          const lines = parsed.data.items.map(resolveLine)
          assertAvailability(lines)
          const total = lines.reduce((sum, line) => sum + line.unitPrice.amount * line.quantity, 0)
          const order: Order & { userId: string } = {
            id: `ord_${randomCode(12).toLowerCase()}`,
            reference: `AF-${randomCode(5)}`,
            userId: user.id,
            status: 'pending',
            placedAt: new Date().toISOString(),
            lines,
            total: { amount: total, currency: 'NGN' },
            contact: parsed.data.contact,
            payment: { method: parsed.data.payment.method },
            ticketIds: [],
          }
          settle(order, parsed.data.payment)
          state.orders.push(order)
          applyOutcome(order, false)
          return publicOrder(order)
        }),

      list: () =>
        respond(() => {
          const user = requireUser()
          return state.orders
            .filter((order) => order.userId === user.id)
            .sort((a, b) => Date.parse(b.placedAt) - Date.parse(a.placedAt))
            .map(publicOrder)
        }),

      get: (id: string) =>
        respond(() => {
          const user = requireUser()
          return publicOrder(findOrder(id, user.id))
        }),

      pay: (orderId: string, payment: PaymentInput) =>
        respond(() => {
          const user = requireUser()
          const order = findOrder(orderId, user.id)
          if (order.status === 'paid') throw new ApiError('conflict', 'That order is already paid.', { orderId })
          const wasHolding = order.status !== 'failed'
          // Stock may have gone while the payment was failing.
          if (!wasHolding) assertAvailability(order.lines)
          settle(order, payment)
          applyOutcome(order, wasHolding)
          return publicOrder(order)
        }),

      confirmTransfer: (orderId: string) =>
        respond(() => {
          const user = requireUser()
          const order = findOrder(orderId, user.id)
          if (order.payment.method !== 'transfer') {
            throw new ApiError('conflict', 'That order was not paid by transfer.', { orderId })
          }
          if (order.status === 'paid') return publicOrder(order)
          order.status = 'paid'
          applyOutcome(order, true)
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
          if (!parsed.success) fail(parsed.error.issues, 'Check the email address.')
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
          const holderName = name?.trim() || email
          state.tickets.push({
            ...ticket,
            id: `tkt_${randomCode(12).toLowerCase()}`,
            code: `AF-${randomCode(4)}-${randomCode(4)}`,
            userId: parkedId(email),
            holderName,
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

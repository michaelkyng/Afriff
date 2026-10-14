import { ApiError } from './contract'
import { formatDateRange, formatDay, formatTime } from './format'
import type {
  Festival,
  FestivalEvent,
  Film,
  Money,
  Order,
  OrderLine,
  PaymentChannel,
  Screening,
  Ticket,
  TicketProduct,
  TicketSelection,
  Venue,
} from './types'

/**
 * The rules of buying, shared by every place an order is taken: the mock
 * adapter in the browser and the Cloud Functions behind the Firebase adapter.
 * Both check a cart the same way, describe it the same way and issue the same
 * tickets, so the demo cannot drift from what the server will accept.
 *
 * Nothing here touches storage. Callers bring the catalogue and the live stock,
 * and do the reading and writing (in a transaction, on the server).
 */

/** How long an unpaid order keeps its tickets aside while the attendee pays. */
export const ORDER_HOLD_MINUTES = 30

/** Unpaid orders one attendee may have open at once, so nobody can sit on the stock. */
export const MAX_OPEN_ORDERS = 3

/** No 0/O, 1/I: codes are read aloud at the door and typed from screenshots. */
const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'

/** Random characters from the code alphabet. 256 is a multiple of 32, so there is no bias. */
export function randomCode(length: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  return Array.from(bytes, (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join('')
}

export const newId = {
  order: () => `ord_${randomCode(12).toLowerCase()}`,
  /** Short enough to read over the phone: AF-7KQ2P. */
  orderReference: () => `AF-${randomCode(5)}`,
  line: () => `line_${randomCode(8).toLowerCase()}`,
  ticket: () => `tkt_${randomCode(12).toLowerCase()}`,
  /** Printed on the ticket and encoded in its QR code. */
  ticketCode: () => `AF-${randomCode(4)}-${randomCode(4)}`,
}

/**
 * Each attempt to pay gets its own provider reference — Paystack refuses to reuse
 * one — so a retry is the order's reference, numbered: AF-7KQ2P-2.
 */
export function attemptReference(orderReference: string, attempt: number): string {
  return `${orderReference}-${attempt}`
}

export function holdExpiry(from: Date = new Date()): string {
  return new Date(from.getTime() + ORDER_HOLD_MINUTES * 60_000).toISOString()
}

// ------------------------------------------------------------------ catalogue

/** What an order is checked against. Lookups, so the server can load only what a cart names. */
export interface OrderCatalog {
  festival: Festival
  product(id: string): TicketProduct | undefined
  screening(id: string): Screening | undefined
  event(id: string): FestivalEvent | undefined
  venue(id: string): Venue | undefined
  film(id: string): Film | undefined
}

export interface OrderCatalogData {
  festival: Festival
  products: readonly TicketProduct[]
  screenings: readonly Screening[]
  events: readonly FestivalEvent[]
  venues: readonly Venue[]
  films: readonly Film[]
}

export function catalogFrom(data: OrderCatalogData): OrderCatalog {
  const index = <T extends { id: string }>(items: readonly T[]) => new Map(items.map((item) => [item.id, item]))
  const products = index(data.products)
  const screenings = index(data.screenings)
  const events = index(data.events)
  const venues = index(data.venues)
  const films = index(data.films)
  return {
    festival: data.festival,
    product: (id) => products.get(id),
    screening: (id) => screenings.get(id),
    event: (id) => events.get(id),
    venue: (id) => venues.get(id),
    film: (id) => films.get(id),
  }
}

/** The event a product admits to: fixed by the product (a gala) or chosen by the attendee (a masterclass). */
export function eventIdFor(product: TicketProduct, selection?: TicketSelection): string | undefined {
  return product.validity.type === 'event' ? (product.validity.eventId ?? selection?.eventId) : undefined
}

// ------------------------------------------------------------------ lines

/**
 * Checks one cart line against the catalogue and the programme, and describes
 * what was bought. Everything an attendee could get wrong is caught here.
 */
export function resolveLine(
  input: { productId: string; quantity: number; selection?: TicketSelection },
  catalog: OrderCatalog,
): OrderLine {
  const product = catalog.product(input.productId)
  if (!product) throw new ApiError('not_found', 'That ticket is no longer on sale.', { productId: input.productId })

  const selection = input.selection ?? {}
  const line: OrderLine = {
    id: newId.line(),
    productId: product.id,
    productName: product.name,
    kind: product.kind,
    unitPrice: product.price,
    quantity: input.quantity,
    title: product.name,
  }

  switch (product.validity.type) {
    case 'festival': {
      line.detail = formatDateRange(catalog.festival.startsAt, catalog.festival.endsAt)
      break
    }
    case 'day': {
      const day = catalog.festival.days.find((item) => item.date === selection.day)
      if (!day) throw new ApiError('validation', 'Choose which day this pass is for.', { field: 'selection.day' })
      line.selection = { day: day.date }
      line.detail = day.label
      break
    }
    case 'screening': {
      const screening = selection.screeningId ? catalog.screening(selection.screeningId) : undefined
      if (!screening) {
        throw new ApiError('validation', 'Choose which screening this ticket is for.', { field: 'selection.screeningId' })
      }
      if (screening.cancelled) {
        throw new ApiError('conflict', 'That screening has been cancelled.', { field: 'selection.screeningId', screeningId: screening.id })
      }
      line.selection = { screeningId: screening.id }
      line.title = catalog.film(screening.filmId)?.title ?? product.name
      line.detail = screeningDetail(screening, catalog.venue(screening.venueId))
      break
    }
    case 'event': {
      const wanted = eventIdFor(product, selection)
      const event = wanted ? catalog.event(wanted) : undefined
      if (!event || event.kind !== product.validity.eventKind) {
        throw new ApiError('validation', 'Choose which session this ticket is for.', { field: 'selection.eventId' })
      }
      line.selection = { eventId: event.id }
      line.title = event.title
      line.detail = `${formatDay(event.startsAt)}, ${formatTime(event.startsAt)} · ${catalog.venue(event.venueId)?.name ?? ''}`
      break
    }
  }

  return line
}

/** Where and when a screening is, ready to show: "Tue 3 Nov, 18:30 · Landmark, Cinema 1". */
export function screeningDetail(screening: Pick<Screening, 'startsAt' | 'screenId'>, venue: Venue | undefined): string {
  const screen = venue?.screens.find((item) => item.id === screening.screenId)
  return `${formatDay(screening.startsAt)}, ${formatTime(screening.startsAt)} · ${venue?.shortName ?? ''}${screen ? `, ${screen.name}` : ''}`
}

export function orderTotal(lines: readonly OrderLine[]): Money {
  return { amount: lines.reduce((sum, line) => sum + line.unitPrice.amount * line.quantity, 0), currency: 'NGN' }
}

// ------------------------------------------------------------------ stock

/** How much of each product and each screening an order takes. */
export interface Demand {
  products: Map<string, number>
  screenings: Map<string, number>
}

export function demandOf(lines: readonly Pick<OrderLine, 'productId' | 'quantity' | 'selection'>[]): Demand {
  const demand: Demand = { products: new Map(), screenings: new Map() }
  for (const line of lines) {
    demand.products.set(line.productId, (demand.products.get(line.productId) ?? 0) + line.quantity)
    const screeningId = line.selection?.screeningId
    if (screeningId) demand.screenings.set(screeningId, (demand.screenings.get(screeningId) ?? 0) + line.quantity)
  }
  return demand
}

/** Live stock, as the caller last read it. */
export interface StockLevels {
  /** Units left of a product; `null` when the product is not limited. */
  remaining(productId: string): number | null
  seatsLeft(screeningId: string): number
}

/**
 * Limits and stock apply to the whole order, not to one line, so splitting a
 * product across lines cannot get past the per-order cap.
 */
export function assertAvailable(demand: Demand, catalog: OrderCatalog, stock: StockLevels): void {
  for (const [productId, quantity] of demand.products) {
    const product = catalog.product(productId)
    if (!product) throw new ApiError('not_found', 'That ticket is no longer on sale.', { productId })
    if (quantity > product.maxPerOrder) {
      throw new ApiError('validation', `Up to ${product.maxPerOrder} ${product.name} tickets per order.`, {
        field: 'quantity',
        productId,
      })
    }
    const left = stock.remaining(productId)
    if (left !== null && quantity > left) {
      throw new ApiError('sold_out', left === 0 ? `${product.name} is sold out.` : `Only ${left} left for ${product.name}.`, {
        productId,
        remaining: left,
      })
    }
  }

  for (const [screeningId, quantity] of demand.screenings) {
    const left = stock.seatsLeft(screeningId)
    if (quantity > left) {
      throw new ApiError('sold_out', left === 0 ? 'That screening is sold out.' : `Only ${left} seats left at that screening.`, {
        screeningId,
        remaining: left,
      })
    }
  }
}

export function seatsLeftAt(screening: Pick<Screening, 'capacity' | 'sold'> | undefined): number {
  return screening ? Math.max(0, screening.capacity - screening.sold) : 0
}

// ------------------------------------------------------------------ tickets

/**
 * Turns a paid order into admissions, one ticket per seat. Everything needed to
 * show and check a ticket is copied onto it, so My tickets works offline.
 */
export function ticketsFor(
  order: Pick<Order, 'id' | 'lines' | 'contact'>,
  catalog: Pick<OrderCatalog, 'screening' | 'event' | 'venue'>,
  issuedAt: string = new Date().toISOString(),
): Ticket[] {
  const tickets: Ticket[] = []
  for (const line of order.lines) {
    const screening = line.selection?.screeningId ? catalog.screening(line.selection.screeningId) : undefined
    const event = line.selection?.eventId ? catalog.event(line.selection.eventId) : undefined
    const venueId = screening?.venueId ?? event?.venueId
    const venue = venueId ? catalog.venue(venueId) : undefined
    for (let index = 0; index < line.quantity; index += 1) {
      tickets.push(withoutUndefined({
        id: newId.ticket(),
        code: newId.ticketCode(),
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
        issuedAt,
      }))
    }
  }
  return tickets
}

/**
 * Drops keys whose value is undefined. Firestore refuses them, and an absent key
 * reads the same as an undefined one everywhere else.
 */
export function withoutUndefined<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T
}

// ------------------------------------------------------------------ payments

/** Paystack's channel names, folded into the few the app shows. */
export function paymentChannel(raw: string | undefined | null): PaymentChannel | undefined {
  if (!raw) return undefined
  const known: Record<string, PaymentChannel> = {
    card: 'card',
    bank: 'bank',
    bank_transfer: 'bank_transfer',
    dedicated_nuban: 'bank_transfer',
    ussd: 'ussd',
    qr: 'qr',
    mobile_money: 'mobile_money',
    apple_pay: 'apple_pay',
  }
  return known[raw] ?? 'other'
}

/**
 * The provider's reason for a failed payment, in words an attendee can act on.
 * Paystack's `gateway_response` is written for merchants, so only the common
 * cases are reworded and the rest fall back to a plain sentence.
 */
export function paymentFailureReason(gatewayResponse?: string | null): string {
  const text = (gatewayResponse ?? '').toLowerCase()
  if (text.includes('insufficient')) return 'Your bank says there was not enough money in the account.'
  if (text.includes('expired')) return 'That card has expired. Try another one.'
  if (text.includes('pin') || text.includes('otp') || text.includes('token')) {
    return 'The code or PIN your bank asked for did not match. Try again.'
  }
  if (text.includes('declin') || text.includes('not permitted') || text.includes('do not honor')) {
    return 'Your bank declined this payment. Try another card or method.'
  }
  return 'That payment did not go through. Nothing was taken; try again or use another method.'
}

/** What an attendee sees when an unpaid order runs out of time. */
export const HOLD_EXPIRED_REASON = 'The time to pay ran out, so the tickets went back on sale. You can try again.'

/** What an attendee sees when a payment lands after their tickets were sold to someone else. */
export const LATE_PAYMENT_REASON =
  'Your payment arrived after your tickets were released, and they have sold out since. We will refund you in full.'

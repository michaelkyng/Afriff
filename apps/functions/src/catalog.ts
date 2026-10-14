import type { Transaction } from 'firebase-admin/firestore'
import { FieldValue } from 'firebase-admin/firestore'
import { ApiError } from '@afriff/api'
import { COLLECTIONS, CURRENT } from '@afriff/api/firebase/schema'
import { catalogFrom, eventIdFor } from '@afriff/api/orders'
import type { Demand, OrderCatalog, StockLevels } from '@afriff/api/orders'
import type { Festival, FestivalEvent, Film, Screening, TicketProduct, TicketSelection, Venue } from '@afriff/api/types'
import { collections, db } from './admin'
import { stockLevels } from './stock'

/**
 * Loads the part of the catalogue a cart (or an order's lines) names: every
 * product, which is a handful, plus only the screenings, events, venues and
 * films it points at.
 *
 * Stock is read again inside each transaction (`readStock`); what this returns
 * is only used to describe and price the order.
 */
export async function loadOrderCatalog(items: readonly { productId: string; selection?: TicketSelection }[]): Promise<OrderCatalog> {
  const [festivalSnapshot, productsSnapshot] = await Promise.all([
    db.collection(COLLECTIONS.festival).doc(CURRENT).get(),
    collections.products().get(),
  ])
  const festival = festivalSnapshot.data() as Festival | undefined
  if (!festival) throw new ApiError('not_found', 'The festival is not set up for sales yet.')
  const products = productsSnapshot.docs.map((doc) => doc.data() as TicketProduct)

  const screeningIds = new Set<string>()
  const eventIds = new Set<string>()
  for (const item of items) {
    if (item.selection?.screeningId) screeningIds.add(item.selection.screeningId)
    const product = products.find((candidate) => candidate.id === item.productId)
    const eventId = product ? eventIdFor(product, item.selection) : undefined
    if (eventId) eventIds.add(eventId)
  }

  const [screenings, events] = await Promise.all([
    getAll<Screening>(COLLECTIONS.screenings, screeningIds),
    getAll<FestivalEvent>(COLLECTIONS.events, eventIds),
  ])
  const venueIds = new Set([...screenings.map((item) => item.venueId), ...events.map((item) => item.venueId)])
  const filmIds = new Set(screenings.map((item) => item.filmId))
  const [venues, films] = await Promise.all([getAll<Venue>(COLLECTIONS.venues, venueIds), getAll<Film>(COLLECTIONS.films, filmIds)])

  return catalogFrom({ festival, products, screenings, events, venues, films })
}

async function getAll<T>(collection: string, ids: Set<string>): Promise<T[]> {
  if (!ids.size) return []
  const snapshots = await db.getAll(...[...ids].map((id) => db.collection(collection).doc(id)))
  return snapshots.filter((snapshot) => snapshot.exists).map((snapshot) => snapshot.data() as T)
}

/**
 * Reads the live stock an order needs, inside a transaction. Firestore wants
 * every read before the first write, so callers read this before changing anything.
 */
export async function readStock(tx: Transaction, demand: Demand): Promise<StockLevels> {
  const productIds = [...demand.products.keys()]
  const screeningIds = [...demand.screenings.keys()]
  const refs = [
    ...productIds.map((id) => collections.products().doc(id)),
    ...screeningIds.map((id) => collections.screenings().doc(id)),
  ]
  const snapshots = refs.length ? await tx.getAll(...refs) : []
  const products = new Map(snapshots.slice(0, productIds.length).map((snapshot) => [snapshot.id, snapshot.data() as TicketProduct | undefined]))
  const screenings = new Map(snapshots.slice(productIds.length).map((snapshot) => [snapshot.id, snapshot.data() as Screening | undefined]))
  return stockLevels(products, screenings)
}

/**
 * Takes stock for an order, or gives it back. Unlimited products (`remaining:
 * null`) are left alone: incrementing a null would turn it into a number.
 */
export function moveStock(tx: Transaction, demand: Demand, catalog: OrderCatalog, direction: 'take' | 'release'): void {
  const sign = direction === 'take' ? 1 : -1
  for (const [productId, quantity] of demand.products) {
    if (catalog.product(productId)?.remaining === null) continue
    tx.update(collections.products().doc(productId), { remaining: FieldValue.increment(-sign * quantity) })
  }
  for (const [screeningId, quantity] of demand.screenings) {
    tx.update(collections.screenings().doc(screeningId), { sold: FieldValue.increment(sign * quantity) })
  }
}

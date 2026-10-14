import { ApiError } from '@afriff/api'
import { formatDay, formatTime } from '@afriff/api/format'
import { COLLECTIONS } from '@afriff/api/firebase/schema'
import type { OrderDoc, TicketDoc } from '@afriff/api/firebase/schema'
import { count, draftForCancel, draftForMove, movedScreening, ticketPatch } from '@afriff/api/ops'
import type { CancelScreeningInput, MoveScreeningInput, ScreeningChange } from '@afriff/api/ops'
import { withoutUndefined } from '@afriff/api/orders'
import type { Film, Screening, Venue } from '@afriff/api/types'
import { collections, db } from '../admin'
import { audit, withoutPosition } from './context'
import type { Who } from './context'

/** What a screening does to the tickets copied from it: they carry its time and place, so My tickets works offline. */
const VOID_FOR_CANCEL = 'The screening was cancelled. We will refund you in full.'

async function load(screeningId: string) {
  const ref = db.collection(COLLECTIONS.screenings).doc(screeningId)
  const [snapshot, venues] = await Promise.all([ref.get(), db.collection(COLLECTIONS.venues).get()])
  const screening = snapshot.data() as (Screening & { position?: number }) | undefined
  if (!screening) throw new ApiError('not_found', 'That screening is not in the programme.', { screeningId })
  const film = (await db.collection(COLLECTIONS.films).doc(screening.filmId).get()).data() as Film | undefined
  return { ref, before: withoutPosition(screening), film, venues: venues.docs.map((doc) => withoutPosition(doc.data() as Venue)) }
}

const ticketsOf = (screeningId: string) => collections.tickets().where('selection.screeningId', '==', screeningId).get()

/**
 * Moves a screening and brings every ticket for it up to date, then offers the
 * announcement. Done with a BulkWriter, since a gala can have hundreds of
 * tickets; each write is idempotent, so a retry after a partial failure lands
 * in the same place.
 */
export async function moveScreening(input: MoveScreeningInput, who: Who): Promise<ScreeningChange> {
  const { ref, before, film, venues } = await load(input.screeningId)
  const after = movedScreening(before, input, venues, who.now)
  const venue = venues.find((item) => item.id === after.venueId)
  const tickets = await ticketsOf(before.id)
  const patch = withoutUndefined(ticketPatch(after, venue))

  const writer = db.bulkWriter()
  writer.update(ref, { startsAt: after.startsAt, endsAt: after.endsAt, venueId: after.venueId, screenId: after.screenId, capacity: after.capacity })
  for (const doc of tickets.docs) writer.update(doc.ref, patch)
  await writer.close()

  await audit(null, who, 'moveScreening',
    `Moved ${film?.title ?? before.id} (${formatDay(before.startsAt)}) from ${formatTime(before.startsAt)} to ${formatDay(after.startsAt)} ${formatTime(after.startsAt)}${before.screenId === after.screenId ? '' : `, ${patch.roomName ?? after.screenId}`}`,
    { kind: 'screening', id: before.id },
    { before: { startsAt: before.startsAt, screenId: before.screenId }, after: { startsAt: after.startsAt, screenId: after.screenId } })

  return { before, after, ticketsAffected: tickets.size, ordersFlagged: 0, draft: draftForMove(before, after, film, venues) }
}

/**
 * Cancels a screening: it stops selling and admitting, its single tickets are
 * voided with a reason the holder sees, and their orders are flagged for a
 * refund. Passes are not tied to a screening, so they are untouched.
 */
export async function cancelScreening(input: CancelScreeningInput, who: Who): Promise<ScreeningChange> {
  const { ref, before, film, venues } = await load(input.screeningId)
  if (before.cancelled) throw new ApiError('conflict', 'That screening is already cancelled.')
  const tickets = (await ticketsOf(before.id)).docs.filter((doc) => (doc.data() as TicketDoc).status === 'valid')
  const orderIds = [...new Set(tickets.map((doc) => (doc.data() as TicketDoc).orderId))]
  const orders = orderIds.length ? await db.getAll(...orderIds.map((id) => collections.orders().doc(id))) : []
  const toFlag = orders.filter((doc) => (doc.data() as OrderDoc | undefined)?.status === 'paid')

  const writer = db.bulkWriter()
  writer.update(ref, { cancelled: true })
  for (const doc of tickets) writer.update(doc.ref, { status: 'void', voidReason: VOID_FOR_CANCEL })
  for (const doc of toFlag) writer.update(doc.ref, { refundDue: true, refundReason: 'Screening cancelled', updatedAt: who.now.toISOString() })
  await writer.close()

  await audit(null, who, 'cancelScreening',
    `Cancelled ${film?.title ?? before.id} (${formatDay(before.startsAt)} ${formatTime(before.startsAt)}): ${count(tickets.length, 'ticket')} voided, ${count(toFlag.length, 'order')} to refund${input.reason ? `. ${input.reason}` : ''}`,
    { kind: 'screening', id: before.id })

  const after = { ...before, cancelled: true }
  return {
    before,
    after,
    ticketsAffected: tickets.length,
    ordersFlagged: toFlag.length,
    draft: draftForCancel(after, film, venues.find((item) => item.id === before.venueId)),
  }
}

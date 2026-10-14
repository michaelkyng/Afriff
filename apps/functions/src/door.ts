import { FieldValue } from 'firebase-admin/firestore'
import { ApiError } from '@afriff/api'
import { decideCheckIn, doorSessions, isPass, marksUsed, NO_COUNT, parseScan, scannedTicket, sessionKey } from '@afriff/api/door'
import type { CheckInResult, DoorCount, DoorSession, SessionRef } from '@afriff/api/door'
import { COLLECTIONS } from '@afriff/api/firebase/schema'
import type { CheckInDoc, DoorStatsDoc, TicketDoc } from '@afriff/api/firebase/schema'
import type { FestivalEvent, Film, Screening, Venue } from '@afriff/api/types'
import { checkInSchema } from '@afriff/validation'
import { collections, db } from './admin'
import { callable, parse } from './callable'

/**
 * The door. Each scan is judged by the shared rules (`@afriff/api/door`) inside
 * one transaction with the ticket, its check-in for this session and the
 * running count, so two doors scanning the same ticket at the same moment let
 * it in once, and the last free seat goes to one pass holder.
 */

/** The emulators let the scanner's rehearsal clock stand in for the real one; a deployed function never does. */
const EMULATED = process.env.FUNCTIONS_EMULATOR === 'true'

async function loadSession(ref: SessionRef): Promise<{ session: DoorSession; events: FestivalEvent[] }> {
  const [sessionSnapshot, eventsSnapshot] = await Promise.all([
    db.collection(ref.kind === 'screening' ? COLLECTIONS.screenings : COLLECTIONS.events).doc(ref.id).get(),
    // Few enough to read whole; a gala screening needs the gala around it.
    db.collection(COLLECTIONS.events).get(),
  ])
  const events = eventsSnapshot.docs.map((doc) => doc.data() as FestivalEvent)
  if (!sessionSnapshot.exists) throw new ApiError('not_found', 'That screening or event is not in the programme.', { ...ref })

  if (ref.kind === 'event') {
    const event = sessionSnapshot.data() as FestivalEvent
    const venue = (await db.collection(COLLECTIONS.venues).doc(event.venueId).get()).data() as Venue | undefined
    const [session] = doorSessions({ screenings: [], events: [event], films: [], venues: venue ? [venue] : [] })
    return { session: session!, events }
  }

  const screening = sessionSnapshot.data() as Screening
  if (screening.cancelled) throw new ApiError('conflict', 'That screening was cancelled. Pick another door.')
  const [film, venue] = await Promise.all([
    db.collection(COLLECTIONS.films).doc(screening.filmId).get(),
    db.collection(COLLECTIONS.venues).doc(screening.venueId).get(),
  ])
  const [session] = doorSessions({
    screenings: [screening],
    events: [],
    films: film.exists ? [film.data() as Film] : [],
    venues: venue.exists ? [venue.data() as Venue] : [],
  })
  return { session: session!, events }
}

/** The ticket a scan names: by id from the QR code, or by the printed code typed in. */
async function findTicketRef(scan: { ticketId?: string; code: string }) {
  if (scan.ticketId) return collections.tickets().doc(scan.ticketId)
  const found = await collections.tickets().where('code', '==', scan.code).limit(1).get()
  return found.empty ? null : found.docs[0]!.ref
}

export const checkIn = callable<'checkIn'>({}, async (data, caller) => {
  if (!caller.role) throw new ApiError('unauthorized', 'This account is not set up for door duty. Ask the festival team.')
  const input = parse(checkInSchema, data, 'Scan a ticket or type its code.')
  const now = EMULATED && input.at ? new Date(input.at) : new Date()
  const at = now.toISOString()

  const { session, events } = await loadSession(input.session)
  const eventOf = (id: string) => events.find((event) => event.id === id)
  const key = sessionKey(session.ref)
  const statsRef = db.collection(COLLECTIONS.doorStats).doc(key)
  const scan = parseScan(input.scan)
  const ticketRef = scan ? await findTicketRef(scan) : null

  return db.runTransaction(async (tx): Promise<CheckInResult> => {
    const ticketSnapshot = ticketRef ? await tx.get(ticketRef) : null
    const stored = ticketSnapshot?.data() as TicketDoc | undefined
    // A QR code naming a real ticket with the wrong code is a forgery, not that ticket.
    const ticket = stored && scan && stored.code === scan.code ? stored : null
    const checkInRef = ticket ? db.collection(COLLECTIONS.checkins).doc(`${key}_${ticket.id}`) : null
    const previousSnapshot = checkInRef ? await tx.get(checkInRef) : null
    const previous = previousSnapshot?.data() as CheckInDoc | undefined
    const count: DoorCount = { ...NO_COUNT, ...((await tx.get(statsRef)).data() as DoorStatsDoc | undefined) }

    const outcome = decideCheckIn({ ticket, session, eventOf, previous: previous ?? null, count, now })
    const result: CheckInResult = {
      outcome,
      at,
      ...(ticket ? { ticket: scannedTicket(ticket) } : {}),
      ...(previous ? { previous: { at: previous.at, byName: previous.byName } } : {}),
      ...(!previous && ticket?.usedAt && outcome === 'already_in' ? { previous: { at: ticket.usedAt } } : {}),
      count: { admitted: count.admitted, passAdmitted: count.passAdmitted },
    }
    if (outcome !== 'admitted' || !ticket || !checkInRef || !ticketRef) return result

    const pass = isPass(ticket)
    const record: CheckInDoc = {
      ticketId: ticket.id,
      ticketCode: ticket.code,
      session: session.ref,
      holderName: ticket.holderName,
      kind: ticket.kind,
      pass,
      at,
      byUid: caller.uid,
      byName: caller.name ?? caller.email ?? 'Door',
    }
    tx.create(checkInRef, record)
    tx.set(statsRef, {
      admitted: FieldValue.increment(1),
      passAdmitted: FieldValue.increment(pass ? 1 : 0),
      updatedAt: at,
    }, { merge: true })
    if (marksUsed(ticket)) tx.update(ticketRef, { status: 'used', usedAt: at })

    return { ...result, count: { admitted: count.admitted + 1, passAdmitted: count.passAdmitted + (pass ? 1 : 0) } }
  })
})

import type { FestivalUpdate, SavedItem, Ticket, UpdateSubject } from './types'

/**
 * Festival updates, sorted out for one attendee.
 *
 * Two questions decide how an update is treated: has it happened yet by the
 * festival clock, and does it touch anything this attendee holds or means to be
 * at. The second is what separates a banner from a line in the inbox.
 */

/** What the attendee is tied to, as ids. Anything empty just means nothing matches. */
export interface AttendeeRefs {
  screeningIds: Set<string>
  eventIds: Set<string>
  venueIds: Set<string>
  filmIds: Set<string>
}

export function emptyRefs(): AttendeeRefs {
  return { screeningIds: new Set(), eventIds: new Set(), venueIds: new Set(), filmIds: new Set() }
}

/** Only what the clock says has been published, newest first. */
export function publishedUpdates(updates: FestivalUpdate[], now: Date): FestivalUpdate[] {
  return updates
    .filter((update) => Date.parse(update.publishedAt) <= now.getTime())
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
}

/**
 * True when the update names something the attendee is tied to.
 *
 * An update with no subject is festival-wide news: it belongs in the inbox for
 * everyone, but it is nobody's in particular, so it never earns a banner.
 */
export function touches(subject: UpdateSubject | undefined, refs: AttendeeRefs): boolean {
  if (!subject) return false
  return Boolean(
    (subject.screeningId && refs.screeningIds.has(subject.screeningId))
    || (subject.eventId && refs.eventIds.has(subject.eventId))
    || (subject.venueId && refs.venueIds.has(subject.venueId))
    || (subject.filmId && refs.filmIds.has(subject.filmId)),
  )
}

/** The published updates that touch this attendee, newest first. */
export function updatesForAttendee(updates: FestivalUpdate[], refs: AttendeeRefs, now: Date): FestivalUpdate[] {
  return publishedUpdates(updates, now).filter((update) => touches(update.subject, refs))
}

/**
 * What deserves interrupting someone: an urgent update about something they
 * have a ticket for and have not read yet.
 */
export function urgentForAttendee(
  updates: FestivalUpdate[],
  refs: AttendeeRefs,
  readIds: Iterable<string>,
  now: Date,
): FestivalUpdate[] {
  const read = new Set(readIds)
  return updatesForAttendee(updates, refs, now).filter(
    (update) => update.severity === 'urgent' && !read.has(update.id),
  )
}

export function unreadCount(updates: FestivalUpdate[], readIds: Iterable<string>, now: Date): number {
  const read = new Set(readIds)
  return publishedUpdates(updates, now).reduce((count, update) => (read.has(update.id) ? count : count + 1), 0)
}

/**
 * What a ticket ties an attendee to: the screening or event it admits them to,
 * and the venue that is at. Passes tie them to nothing in particular.
 */
export function refsFromTickets(tickets: Ticket[], venueIdOf: (ticket: Ticket) => string | undefined): AttendeeRefs {
  const refs = emptyRefs()
  for (const ticket of tickets) {
    if (ticket.status !== 'valid') continue
    if (ticket.selection?.screeningId) refs.screeningIds.add(ticket.selection.screeningId)
    if (ticket.selection?.eventId) refs.eventIds.add(ticket.selection.eventId)
    const venueId = venueIdOf(ticket)
    if (venueId) refs.venueIds.add(venueId)
  }
  return refs
}

/** What a saved item ties them to. A venue is not known without the programme. */
export function refsFromSaved(items: SavedItem[]): AttendeeRefs {
  const refs = emptyRefs()
  for (const item of items) {
    if (item.kind === 'screening') refs.screeningIds.add(item.refId)
    else if (item.kind === 'event') refs.eventIds.add(item.refId)
    else refs.filmIds.add(item.refId)
  }
  return refs
}

/** Folds another set of ids in, so a plan and a pile of tickets can be asked about together. */
export function mergeRefs(...all: AttendeeRefs[]): AttendeeRefs {
  const merged = emptyRefs()
  for (const refs of all) {
    for (const id of refs.screeningIds) merged.screeningIds.add(id)
    for (const id of refs.eventIds) merged.eventIds.add(id)
    for (const id of refs.venueIds) merged.venueIds.add(id)
    for (const id of refs.filmIds) merged.filmIds.add(id)
  }
  return merged
}

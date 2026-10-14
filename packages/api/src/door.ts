import type { SignInInput } from '@afriff/validation'
import { formatDay, formatTime, lagosDateKey } from './format'
import type {
  EventKind,
  FestivalEvent,
  Film,
  ISODateTime,
  ProductKind,
  Screening,
  ScreeningFormat,
  Ticket,
  TicketSelection,
  Venue,
} from './types'

/**
 * The door: who may scan, what they check people into, and the rules that
 * decide each scan. The rules are shared by the mock and the `checkIn` Cloud
 * Function, so the demo and the real door can never disagree.
 */

// ------------------------------------------------------------------ staff

/** Set as a Firebase custom claim (`role`) by `bun run staff`. All three can work a door. */
export type StaffRole = 'admin' | 'ops' | 'door'

export const STAFF_ROLES: readonly StaffRole[] = ['admin', 'ops', 'door']

export function isStaffRole(value: unknown): value is StaffRole {
  return typeof value === 'string' && (STAFF_ROLES as readonly string[]).includes(value)
}

export interface StaffMember {
  id: string
  email: string
  name: string
  role: StaffRole
}

// ------------------------------------------------------------------ sessions

export type SessionKind = 'screening' | 'event'

/** What a door is checking people into. */
export interface SessionRef {
  kind: SessionKind
  id: string
}

/** A screening or an event as the door sees it, ready to show. */
export interface DoorSession {
  ref: SessionRef
  title: string
  /** Where, ready to show: "Landmark Cinemas, Screen 1". */
  place: string
  venueId: string
  /** The venue alone, for picking which door this is: "Landmark". */
  venueName: string
  startsAt: ISODateTime
  endsAt: ISODateTime
  /** Seats, for a screening. Events are not counted against a capacity. */
  capacity: number | null
  /** Seats sold as single tickets. Pass holders cannot take those. */
  reserved: number
  format?: ScreeningFormat
  eventKind?: EventKind
}

/** How many have come through, from every door scanning the session. */
export interface DoorCount {
  admitted: number
  /** Of those, on a pass: they use the seats single tickets did not reserve. */
  passAdmitted: number
}

export const NO_COUNT: DoorCount = { admitted: 0, passAdmitted: 0 }

/** How long before the start the doors open. */
export const DOORS_OPEN_MINUTES = 60

/** One id per session, for the check-in and count documents. */
export function sessionKey(ref: SessionRef): string {
  return `${ref.kind}_${ref.id}`
}

export function doorsOpenAt(session: Pick<DoorSession, 'startsAt'>): Date {
  return new Date(Date.parse(session.startsAt) - DOORS_OPEN_MINUTES * 60_000)
}

/** Every screening and event in the programme, earliest first. */
export function doorSessions(data: {
  screenings: readonly Screening[]
  events: readonly FestivalEvent[]
  films: readonly Film[]
  venues: readonly Venue[]
}): DoorSession[] {
  const films = new Map(data.films.map((film) => [film.id, film]))
  const venues = new Map(data.venues.map((venue) => [venue.id, venue]))

  const screenings = data.screenings.map((screening): DoorSession => {
    const venue = venues.get(screening.venueId)
    const screen = venue?.screens.find((item) => item.id === screening.screenId)
    return {
      ref: { kind: 'screening', id: screening.id },
      title: films.get(screening.filmId)?.title ?? 'Screening',
      place: [venue?.shortName ?? venue?.name, screen?.name].filter(Boolean).join(', '),
      venueId: screening.venueId,
      venueName: venue?.shortName ?? venue?.name ?? '',
      startsAt: screening.startsAt,
      endsAt: screening.endsAt,
      capacity: screening.capacity,
      reserved: screening.sold,
      format: screening.format,
    }
  })

  const events = data.events.map((event): DoorSession => ({
    ref: { kind: 'event', id: event.id },
    title: event.title,
    place: venues.get(event.venueId)?.name ?? '',
    venueId: event.venueId,
    venueName: venues.get(event.venueId)?.shortName ?? venues.get(event.venueId)?.name ?? '',
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    capacity: null,
    reserved: 0,
    eventKind: event.kind,
  }))

  return [...screenings, ...events].sort((a, b) => a.startsAt.localeCompare(b.startsAt))
}

// ------------------------------------------------------------------ scans

/** No 0/O or 1/I: the alphabet ticket codes are drawn from (see `orders.ts`). */
const CODE = /^AF-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/

/**
 * Reads what the camera or the keyboard gave: the QR payload
 * (`AF1|<ticket>|<code>|<starts>`, see `tickets.ts`), or the printed code typed
 * in any case and spacing ("af 7kq2 p4nr"). Null when it is neither.
 */
export function parseScan(raw: string): { ticketId?: string; code: string } | null {
  const text = raw.trim()
  if (text.startsWith('AF1|')) {
    const [, ticketId, code] = text.split('|')
    return ticketId && code && CODE.test(code) ? { ticketId, code } : null
  }
  const compact = text.toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (!/^AF[A-Z0-9]{8}$/.test(compact)) return null
  const code = `AF-${compact.slice(2, 6)}-${compact.slice(6)}`
  return CODE.test(code) ? { code } : null
}

// ------------------------------------------------------------------ rules

const PASSES: readonly ProductKind[] = ['festival_pass', 'day_pass']

/** Passes get people into many sessions and never reserve a seat; everything else is one admission. */
export function isPass(ticket: Pick<Ticket, 'kind'>): boolean {
  return PASSES.includes(ticket.kind)
}

/**
 * Whether a ticket is for this session at all, leaving aside its status and the
 * time. As the festival sells them (see the FAQ on passes):
 *
 * - A **festival pass** covers every standard screening, the industry panels and
 *   the Filmmakers' Mixer. A **day pass** covers that day's standard screenings
 *   and panels.
 * - A **single screening** ticket covers its screening.
 * - **Masterclasses, galas and the awards** are ticketed on their own, whatever
 *   pass someone holds. A gala screening is entered on its gala's ticket.
 */
export function ticketCovers(
  ticket: { kind: ProductKind; selection?: TicketSelection },
  session: DoorSession,
  eventOf: (id: string) => Pick<FestivalEvent, 'id' | 'kind' | 'venueId' | 'startsAt' | 'endsAt'> | undefined,
): boolean {
  const selection = ticket.selection ?? {}
  const day = lagosDateKey(session.startsAt)

  if (session.ref.kind === 'screening') {
    if (session.format === 'Gala') {
      // The gala screening belongs to the gala happening around it, at the same venue.
      const event = selection.eventId ? eventOf(selection.eventId) : undefined
      return Boolean(
        event
        && (event.kind === 'gala' || event.kind === 'awards')
        && event.venueId === session.venueId
        && Date.parse(event.startsAt) <= Date.parse(session.startsAt)
        && Date.parse(session.startsAt) < Date.parse(event.endsAt),
      )
    }
    if (ticket.kind === 'screening') return selection.screeningId === session.ref.id
    if (ticket.kind === 'festival_pass') return true
    if (ticket.kind === 'day_pass') return selection.day === day
    return false
  }

  if (selection.eventId === session.ref.id) return true
  if (session.eventKind === 'panel') return ticket.kind === 'festival_pass' || (ticket.kind === 'day_pass' && selection.day === day)
  if (session.eventKind === 'social') return ticket.kind === 'festival_pass'
  return false
}

export type CheckInOutcome =
  | 'admitted'
  | 'already_in'
  | 'wrong_session'
  | 'passed_on'
  | 'void'
  | 'unknown'
  | 'too_early'
  | 'ended'
  | 'full'

export interface CheckInDecisionInput {
  /** The ticket the scan named, or null when there is none (or the code did not match). */
  ticket: Pick<Ticket, 'kind' | 'status' | 'selection'> | null
  session: DoorSession
  eventOf: Parameters<typeof ticketCovers>[2]
  /** The ticket's earlier check-in at this session, if any. */
  previous: { at: ISODateTime } | null
  count: DoorCount
  now: Date
}

/**
 * Decides one scan. The order matters: the door first (is it open?), then the
 * ticket (is it real and still good?), then whether it is for here, then the
 * room (has it been used here; is there a seat for a pass?).
 */
export function decideCheckIn({ ticket, session, eventOf, previous, count, now }: CheckInDecisionInput): CheckInOutcome {
  if (now < doorsOpenAt(session)) return 'too_early'
  if (now.getTime() > Date.parse(session.endsAt)) return 'ended'
  if (!ticket) return 'unknown'
  if (ticket.status === 'transferred') return 'passed_on'
  if (ticket.status === 'void') return 'void'
  if (!ticketCovers(ticket, session, eventOf)) return 'wrong_session'
  if (previous || ticket.status === 'used') return 'already_in'
  if (isPass(ticket) && session.capacity !== null && session.reserved + count.passAdmitted >= session.capacity) return 'full'
  return 'admitted'
}

/** A single ticket is spent once it is used; a pass carries on to the next session. */
export function marksUsed(ticket: Pick<Ticket, 'kind'>): boolean {
  return !isPass(ticket)
}

// ------------------------------------------------------------------ results

/** What the door is shown about the ticket: enough to check it against the person, no more. */
export interface ScannedTicket {
  id: string
  code: string
  holderName: string
  productName: string
  kind: ProductKind
  /** What it admits to, ready to show: "Salt Roads", "Festival Pass". */
  title: string
  subtitle?: string
}

export interface CheckInResult {
  outcome: CheckInOutcome
  /** When the scan was judged. */
  at: ISODateTime
  ticket?: ScannedTicket
  /** For `already_in`: the earlier check-in. */
  previous?: { at: ISODateTime; byName?: string }
  count: DoorCount
}

export function scannedTicket(ticket: Ticket): ScannedTicket {
  return {
    id: ticket.id,
    code: ticket.code,
    holderName: ticket.holderName,
    productName: ticket.productName,
    kind: ticket.kind,
    title: ticket.title,
    ...(ticket.subtitle ? { subtitle: ticket.subtitle } : {}),
  }
}

/** "Tue 3 Nov, 18:30": when a session is, for the session list and result screens. */
export function sessionWhen(session: Pick<DoorSession, 'startsAt'>): string {
  return `${formatDay(session.startsAt)}, ${formatTime(session.startsAt)}`
}

// ------------------------------------------------------------------ contract

export interface CheckInInput {
  session: SessionRef
  /** The QR payload, or a printed code as typed. */
  scan: string
  /**
   * The scanner's clock, for rehearsing festival week before it happens. Only
   * the mock and the Firebase emulator honour it; a deployed server uses its own.
   */
  at?: ISODateTime
}

/**
 * The door staff's API: the scanner app talks only to this, through the mock or
 * the Firebase adapter, the way the attendee app talks to `AttendeeApi`.
 */
export interface DoorApi {
  auth: {
    /** The staff member signed in on this device, or null. */
    restore(): Promise<StaffMember | null>
    /**
     * Signs a staff member in. Throws `ApiError('unauthorized')` for a wrong pair,
     * and for an account that is not set up for door duty.
     */
    signIn(input: SignInInput): Promise<StaffMember>
    signOut(): Promise<void>
  }
  /** Every screening and event, earliest first. */
  sessions(): Promise<DoorSession[]>
  /**
   * Judges a scan and, when it admits, records the check-in. Every outcome is a
   * result, not an error; errors are for the door itself (offline, signed out).
   */
  checkIn(input: CheckInInput): Promise<CheckInResult>
  /** Follows the count for a session as every door adds to it. Returns a function that stops listening. */
  watchCount(session: SessionRef, listener: (count: DoorCount) => void): () => void
}

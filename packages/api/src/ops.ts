import type { SignInInput } from '@afriff/validation'
import type {
  CancelScreeningInput,
  DeleteUpdateInput,
  InviteStaffInput,
  MarkRefundedInput,
  MoveScreeningInput,
  PublishUpdateInput,
  ResendOrderEmailInput,
  ReissueTicketInput,
  SetStaffRoleInput,
  UpdateProductInput,
  VoidTicketInput,
} from '@afriff/validation'
import { ApiError } from './contract'
import type { DoorCount, SessionRef, StaffMember, StaffRole } from './door'
import { formatDay, formatTime, lagosDateKey } from './format'
import { screeningDetail } from './orders'
import type {
  FestivalEvent,
  FestivalUpdate,
  Film,
  ISODateTime,
  Money,
  Order,
  Screening,
  Section,
  Ticket,
  TicketProduct,
  UpdateKind,
  UpdateSeverity,
  UpdateSubject,
  Venue,
} from './types'

export type {
  CancelScreeningInput,
  DeleteUpdateInput,
  InviteStaffInput,
  MarkRefundedInput,
  MoveScreeningInput,
  PublishUpdateInput,
  ResendOrderEmailInput,
  ReissueTicketInput,
  SetStaffRoleInput,
  UpdateProductInput,
  VoidTicketInput,
} from '@afriff/validation'

/**
 * The Ops Console: what the festival team can see and change, shared by the
 * mock and the `ops` Cloud Function so they behave alike. Reads come straight
 * from Firestore (the rules let ops staff read orders and tickets); every
 * change goes through one callable that checks it, applies it and records who
 * did it in the activity log.
 */

// ------------------------------------------------------------------ who

/** Ops and admin staff run the console; door staff only scan. */
export function canUseOps(role: StaffRole | undefined): boolean {
  return role === 'ops' || role === 'admin'
}

/** Staff changes are for admins: nobody should be able to grant themselves more. */
const ADMIN_ONLY: readonly OpsActionName[] = ['inviteStaff', 'setStaffRole']

export function canDo(role: StaffRole | undefined, action: OpsActionName): boolean {
  if (!canUseOps(role)) return false
  return role === 'admin' || !ADMIN_ONLY.includes(action)
}

// ------------------------------------------------------------------ what ops sees

/** An order, with the bookkeeping attendees never see. */
export interface OpsOrder extends Order {
  userId: string
  /** Money that landed without tickets, or twice: refund it in Paystack, then mark it here. */
  refundDue?: boolean
  refundReason?: string
  refundedAt?: ISODateTime
  refundNote?: string
  duplicatePayments?: string[]
}

export interface OpsTicket extends Ticket {
  userId: string | null
  claimEmail?: string
}

/** An email sent (or failing) through the outbox, for "did they get it?". */
export interface OpsMail {
  id: string
  template: string
  to: string
  status: 'queued' | 'sending' | 'sent' | 'failed'
  createdAt: ISODateTime
  sentAt?: ISODateTime
  error?: string
}

export interface OpsOrderDetail {
  order: OpsOrder
  tickets: OpsTicket[]
  mail: OpsMail[]
}

export interface OpsOverview {
  paidOrders: number
  revenue: Money
  ticketsIssued: number
  pendingOrders: number
  refundsDue: number
}

export interface OpsProgramme {
  screenings: Screening[]
  events: FestivalEvent[]
  films: Film[]
  venues: Venue[]
  sections: Section[]
}

export interface StaffAccount extends StaffMember {
  /** False once the role was taken away. */
  active: boolean
  updatedAt?: ISODateTime
}

export type AuditTarget = { kind: 'screening' | 'update' | 'order' | 'ticket' | 'product' | 'staff'; id: string }

/** One change in the activity log. */
export interface AuditEntry {
  id: string
  at: ISODateTime
  byUid: string
  byName: string
  action: OpsActionName
  /** What happened, ready to read: "Moved Salt Roads (Tue 3 Nov) from 18:30 to 21:00". */
  summary: string
  target?: AuditTarget
}

/** A draft announcement, offered after a change so the attendees it affects hear about it. */
export interface UpdateDraft {
  kind: UpdateKind
  severity: UpdateSeverity
  title: string
  body: string
  subject?: UpdateSubject
  link?: string
}

export interface ScreeningChange {
  before: Screening
  after: Screening
  /** Tickets brought up to date (moved) or cancelled. */
  ticketsAffected: number
  /** Orders flagged for a refund (cancelled). */
  ordersFlagged: number
  draft: UpdateDraft
}

// ------------------------------------------------------------------ actions

/** Every change Ops can make, with what it takes and what it gives back. */
export interface OpsActions {
  moveScreening: { input: MoveScreeningInput; output: ScreeningChange }
  cancelScreening: { input: CancelScreeningInput; output: ScreeningChange }
  publishUpdate: { input: PublishUpdateInput; output: { update: FestivalUpdate; emailed: number } }
  deleteUpdate: { input: DeleteUpdateInput; output: { id: string } }
  updateProduct: { input: UpdateProductInput; output: TicketProduct }
  resendOrderEmail: { input: ResendOrderEmailInput; output: { queued: true } }
  voidTicket: { input: VoidTicketInput; output: OpsTicket }
  reissueTicket: { input: ReissueTicketInput; output: OpsTicket }
  markRefunded: { input: MarkRefundedInput; output: OpsOrder }
  listStaff: { input: Record<string, never>; output: StaffAccount[] }
  inviteStaff: { input: InviteStaffInput; output: { staff: StaffAccount; inviteSent: boolean } }
  setStaffRole: { input: SetStaffRoleInput; output: StaffAccount }
}

export type OpsActionName = keyof OpsActions
export type OpsActionInput<A extends OpsActionName> = OpsActions[A]['input']
export type OpsActionOutput<A extends OpsActionName> = OpsActions[A]['output']

/** What the console talks to, through the mock or the Firebase adapter. */
export interface OpsApi {
  auth: {
    restore(): Promise<StaffMember | null>
    /** Throws `ApiError('unauthorized')` for a wrong pair, and for an account that is not ops or admin. */
    signIn(input: SignInInput): Promise<StaffMember>
    signOut(): Promise<void>
  }
  overview(): Promise<OpsOverview>
  programme(): Promise<OpsProgramme>
  products(): Promise<TicketProduct[]>
  /** Every update, published and scheduled, newest first. */
  updates(): Promise<FestivalUpdate[]>
  orders: {
    recent(): Promise<OpsOrder[]>
    /** By order reference (AF-7KQ2P), ticket code (AF-7KQ2-P4NR) or email. */
    search(text: string): Promise<OpsOrder[]>
    refundsDue(): Promise<OpsOrder[]>
    pending(): Promise<OpsOrder[]>
    /** Throws `ApiError('not_found')`. */
    get(id: string): Promise<OpsOrderDetail>
  }
  /** Tickets for a screening or event, to know who a change affects. */
  ticketsFor(session: SessionRef): Promise<OpsTicket[]>
  doorCount(session: SessionRef): Promise<DoorCount>
  audit(): Promise<AuditEntry[]>
  act<A extends OpsActionName>(action: A, input: OpsActionInput<A>): Promise<OpsActionOutput<A>>
}

// ------------------------------------------------------------------ search

/** What a search box in Ops was given: an order reference, a ticket code, or an email. */
export function parseOpsQuery(text: string): { kind: 'reference' | 'code' | 'email'; value: string } | null {
  const value = text.trim()
  if (/^AF-[A-Z0-9]{5}$/i.test(value)) return { kind: 'reference', value: value.toUpperCase() }
  if (/^AF-?[A-Z0-9]{4}-?[A-Z0-9]{4}$/i.test(value.replace(/\s/g, ''))) {
    const compact = value.toUpperCase().replace(/[^A-Z0-9]/g, '')
    return { kind: 'code', value: `AF-${compact.slice(2, 6)}-${compact.slice(6)}` }
  }
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return { kind: 'email', value: value.toLowerCase() }
  return null
}

// ------------------------------------------------------------------ moving a screening

/**
 * A screening moved to a new time or screen, keeping its length. Refuses a
 * move into the past, onto a screen at another venue that does not exist, or
 * onto a screen too small for the seats already sold.
 */
export function movedScreening(before: Screening, input: MoveScreeningInput, venues: readonly Venue[], now: Date = new Date()): Screening {
  if (before.cancelled) throw new ApiError('conflict', 'That screening is cancelled. It cannot be moved.')
  const startsAt = new Date(input.startsAt)
  if (startsAt.getTime() < now.getTime()) throw new ApiError('validation', 'Pick a time that has not passed.', { field: 'startsAt' })
  const screen = venues.flatMap((venue) => venue.screens.map((item) => ({ venue, screen: item }))).find((item) => item.screen.id === input.screenId)
  if (!screen) throw new ApiError('validation', 'Pick a screen.', { field: 'screenId' })
  if (screen.screen.capacity < before.sold) {
    throw new ApiError('validation', `${screen.screen.name} seats ${screen.screen.capacity}, and ${before.sold} seats are already sold.`, { field: 'screenId' })
  }
  const length = Date.parse(before.endsAt) - Date.parse(before.startsAt)
  return {
    ...before,
    startsAt: toLagosIso(startsAt.getTime()),
    endsAt: toLagosIso(startsAt.getTime() + length),
    venueId: screen.venue.id,
    screenId: screen.screen.id,
    capacity: screen.screen.capacity,
  }
}

/** Lagos is UTC+1 all year, and the programme is written in its time. */
export function toLagosIso(ms: number): ISODateTime {
  return `${new Date(ms + 3_600_000).toISOString().slice(0, 19)}+01:00`
}

/** What tickets for a screening say about it, brought up to date after a move. */
export function ticketPatch(screening: Screening, venue: Venue | undefined): Pick<Ticket, 'startsAt' | 'endsAt' | 'venueId' | 'venueName' | 'roomName' | 'subtitle'> {
  return {
    startsAt: screening.startsAt,
    endsAt: screening.endsAt,
    venueId: screening.venueId,
    venueName: venue?.name,
    roomName: venue?.screens.find((item) => item.id === screening.screenId)?.name,
    subtitle: screeningDetail(screening, venue),
  }
}

// ------------------------------------------------------------------ drafting updates

function place(screening: Pick<Screening, 'screenId'>, venue: Venue | undefined): string {
  const screen = venue?.screens.find((item) => item.id === screening.screenId)
  return [venue?.shortName ?? venue?.name, screen?.name].filter(Boolean).join(', ')
}

/**
 * The announcement for a moved screening, written to be read once by someone
 * holding a ticket. Copy rules as elsewhere: no em or en dashes.
 */
export function draftForMove(before: Screening, after: Screening, film: Film | undefined, venues: readonly Venue[]): UpdateDraft {
  const title = film?.title ?? 'A screening'
  const venueOf = (id: string) => venues.find((venue) => venue.id === id)
  const sameDay = lagosDateKey(before.startsAt) === lagosDateKey(after.startsAt)
  const samePlace = before.screenId === after.screenId
  const when = sameDay ? formatTime(after.startsAt) : `${formatDay(after.startsAt)} at ${formatTime(after.startsAt)}`
  const headline = samePlace ? `${title} now starts at ${when}` : `${title} moves to ${place(after, venueOf(after.venueId))}`
  const body = [
    `The ${formatDay(before.startsAt)} ${formatTime(before.startsAt)} screening of ${title} now starts ${sameDay ? 'at' : 'on'} ${when}`,
    samePlace ? '.' : ` at ${place(after, venueOf(after.venueId))}.`,
    ' Your ticket stands for the new time. If you cannot make it, the festival desk can exchange or refund it.',
  ].join('')
  return {
    kind: 'schedule',
    severity: 'urgent',
    title: headline,
    body,
    subject: { screeningId: after.id, filmId: after.filmId },
    link: film ? `/programme/${film.slug}` : undefined,
  }
}

export function draftForCancel(screening: Screening, film: Film | undefined, venue: Venue | undefined): UpdateDraft {
  const title = film?.title ?? 'A screening'
  return {
    kind: 'schedule',
    severity: 'urgent',
    title: `${title} on ${formatDay(screening.startsAt)} is cancelled`,
    body: `We are sorry: the ${formatTime(screening.startsAt)} screening of ${title} at ${place(screening, venue)} will not go ahead. Single tickets for it are refunded in full, with nothing to do on your part. Passes are not affected.`,
    subject: { screeningId: screening.id, filmId: screening.filmId },
    link: film ? `/programme/${film.slug}` : undefined,
  }
}

// ------------------------------------------------------------------ summaries for the activity log

/** "1 ticket", "3 tickets". */
export function count(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`
}

export const AUDIT_LABELS: Record<OpsActionName, string> = {
  moveScreening: 'Moved a screening',
  cancelScreening: 'Cancelled a screening',
  publishUpdate: 'Published an update',
  deleteUpdate: 'Deleted an update',
  updateProduct: 'Changed a product',
  resendOrderEmail: 'Resent a confirmation',
  voidTicket: 'Voided a ticket',
  reissueTicket: 'Reissued a ticket',
  markRefunded: 'Marked a refund done',
  listStaff: 'Listed staff',
  inviteStaff: 'Invited staff',
  setStaffRole: 'Changed a staff role',
}

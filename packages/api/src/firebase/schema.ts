import type { ApiErrorCode } from '../contract'
import type { CheckInInput, CheckInResult, DoorCount, SessionRef, StaffRole } from '../door'
import type { AuditTarget, OpsActionName, OpsActions } from '../ops'
import type {
  CheckoutInput,
  FestivalInfo,
  Order,
  PaymentIntent,
  ProductKind,
  SavedKind,
  Ticket,
  TicketTransferInput,
} from '../types'

/**
 * The Firestore layout and the callable functions, shared by the browser adapter
 * (`./index.ts`), the Cloud Functions (`apps/functions`) and the seed script.
 * `firebase/firestore.rules` enforces the same shapes; change them together.
 *
 * No SDK imports here, so the server can use it with the Admin SDK.
 *
 * Who writes what:
 * - The catalogue (festival, programme, products, info, updates) is public to
 *   read and written only by trusted tooling with the Admin SDK.
 * - An attendee writes their own profile and saved list, checked by the rules.
 * - Orders, tickets, mail and payment events are written only by Cloud
 *   Functions. Attendees can read their own orders and tickets, nothing else.
 * - Check-ins are written only by the `checkIn` function; door staff (a `role`
 *   claim) can read the running counts.
 * - Ops and admin staff can read orders, tickets, profiles, mail, check-ins
 *   and the activity log; every change they make goes through the `ops`
 *   function, which records it in `audit`.
 */

/** Where callable functions run. Keep `apps/functions` and `NUXT_PUBLIC_FIREBASE_FUNCTIONS_REGION` in step. */
export const DEFAULT_FUNCTIONS_REGION = 'europe-west1'

export const COLLECTIONS = {
  festival: 'festival',
  venues: 'venues',
  sections: 'sections',
  films: 'films',
  screenings: 'screenings',
  events: 'events',
  products: 'products',
  updates: 'updates',
  info: 'info',
  users: 'users',
  /** Under `users/{uid}`. */
  saved: 'saved',
  orders: 'orders',
  tickets: 'tickets',
  mail: 'mail',
  paymentEvents: 'paymentEvents',
  /** `checkins/{sessionKey}_{ticketId}`: one per ticket per session, so a second scan finds the first. */
  checkins: 'checkins',
  /** `doorStats/{sessionKey}`: the running count every door adds to. */
  doorStats: 'doorStats',
  /** `audit/{id}`: every change made in Ops, by whom. */
  audit: 'audit',
  /** `staff/{uid}`: who has a staff role, so Ops can list them without scanning every account. */
  staff: 'staff',
} as const

/** The one document in `festival` and `info`: this edition. */
export const CURRENT = 'current'

/**
 * Catalogue documents are the domain models as they are (`Film`, `Venue`, …),
 * stored under their own `id`, plus their place in the list. Firestore returns
 * documents by id, so `position` keeps the order the festival chose.
 */
export interface Positioned {
  position: number
}

export type InfoDoc = FestivalInfo

/** A Firestore timestamp from either SDK. Only what the mappers need. */
export interface TimestampLike {
  toDate(): Date
}

/**
 * `users/{uid}`. Written by the attendee, checked by the rules: the email has to
 * be the one on their sign-in, the name has to be the first and last together,
 * and the times are the server's.
 */
export interface UserDoc {
  email: string
  firstName: string
  lastName: string
  name: string
  phone?: string
  createdAt: TimestampLike
  updatedAt: TimestampLike
}

/** `users/{uid}/saved/{kind}_{refId}`. The id makes saving the same thing twice a no-op. */
export interface SavedDoc {
  kind: SavedKind
  refId: string
  savedAt: TimestampLike
}

export function savedDocId(kind: SavedKind, refId: string): string {
  return `${kind}_${refId}`
}

/** One attempt to pay, as opened with Paystack. */
export interface PaymentAttempt {
  reference: string
  accessCode: string
  authorizationUrl: string
  openedAt: string
}

/** `orders/{id}`. Written only by Cloud Functions. */
export interface OrderDoc extends Order {
  userId: string
  /** Whether the order is currently holding its stock. */
  holds: boolean
  attempts: PaymentAttempt[]
  /** Set when money landed that could not become tickets, for the team to refund. */
  refundDue?: boolean
  /** Payments that succeeded on an order already paid, for the team to refund. */
  duplicatePayments?: string[]
  updatedAt: string
}

/**
 * `tickets/{id}`. Written only by Cloud Functions. A ticket passed on to an email
 * with no account yet has no owner and waits under `claimEmail` until someone
 * with that email, confirmed, signs in.
 */
export interface TicketDoc extends Ticket {
  userId: string | null
  claimEmail?: string
}

export type MailTemplate = 'order_paid' | 'ticket_received' | 'update_notice' | 'staff_invite'

/**
 * `mail/{id}`: the outbox. Cloud Functions write a message here in the same
 * transaction as whatever it is about, and a trigger sends it through Brevo, so
 * an order is never paid without its email being queued.
 */
export interface MailDoc {
  template: MailTemplate
  to: { email: string; name?: string }
  /** What it is about, so Ops can show an order's emails. */
  orderId?: string
  params: Record<string, unknown>
  status: 'queued' | 'sending' | 'sent' | 'failed'
  attempts: number
  createdAt: string
  sentAt?: string
  messageId?: string
  error?: string
}

/** `checkins/{sessionKey}_{ticketId}`. Written only by the `checkIn` function. */
export interface CheckInDoc {
  ticketId: string
  ticketCode: string
  session: SessionRef
  holderName: string
  kind: ProductKind
  pass: boolean
  at: string
  byUid: string
  byName: string
}

/** `doorStats/{sessionKey}`. Written only by the `checkIn` function; read by door staff. */
export interface DoorStatsDoc extends DoorCount {
  updatedAt: string
}

/** `audit/{id}`. Written only by the `ops` function. */
export interface AuditDoc {
  at: string
  byUid: string
  byName: string
  action: OpsActionName
  summary: string
  target?: AuditTarget
  /** The fields that changed, before and after, for the record. */
  before?: Record<string, unknown>
  after?: Record<string, unknown>
}

/** `staff/{uid}`. Kept in step with the `role` claim by the `ops` function and `bun run staff`. */
export interface StaffDoc {
  email: string
  name: string
  role: StaffRole | null
  active: boolean
  updatedAt: string
  updatedBy: string
}

// ------------------------------------------------------------------ callables

/** Callable names, and what each takes and returns. */
export interface CallableContract {
  checkout: { request: CheckoutInput; response: PaymentIntent }
  payOrder: { request: { orderId: string }; response: PaymentIntent }
  verifyOrder: { request: { orderId: string }; response: Order }
  transferTicket: { request: TicketTransferInput & { ticketId: string }; response: Ticket }
  claimTickets: { request: Record<string, never>; response: { claimed: number } }
  checkIn: { request: CheckInInput; response: CheckInResult }
  ops: { request: { [A in OpsActionName]: { action: A } & OpsActions[A]['input'] }[OpsActionName]; response: unknown }
}

export type CallableName = keyof CallableContract

/**
 * What a callable's error carries in `details`, so the adapter can rebuild the
 * same `ApiError` the mock would have thrown.
 */
export interface CallableErrorDetails {
  code: ApiErrorCode
  [key: string]: unknown
}

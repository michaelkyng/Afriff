import type { CodePurpose, Genre } from '@afriff/validation'

/**
 * Shared AFRIFF domain models for apps and API adapters.
 *
 * These mirror what the future backend will return. The mock API returns exactly
 * these shapes, so pages and components never know whether data is mocked.
 */

/** ISO-8601 date-time with offset, e.g. `2026-11-03T18:30:00+01:00`. */
export type ISODateTime = string
/** ISO-8601 calendar date, e.g. `2026-11-03`. */
export type ISODate = string

/** Money in minor units (kobo for NGN), the way payment providers expect it. */
export interface Money {
  amount: number
  currency: 'NGN'
}

// ------------------------------------------------------------------ festival

export interface Festival {
  id: string
  name: string
  shortName: string
  /** Display title for this edition, e.g. "AFRIFF 2026". */
  editionTitle: string
  tagline: string
  city: string
  timezone: 'Africa/Lagos'
  startsAt: ISODateTime
  endsAt: ISODateTime
  /** The festival days in order, one per calendar date. */
  days: FestivalDay[]
  supportEmail: string
}

export interface FestivalDay {
  date: ISODate
  /** 1-based day number within the festival. */
  number: number
  label: string
  highlight?: string
}

// ------------------------------------------------------------------ programme

export interface Venue {
  id: string
  slug: string
  name: string
  shortName: string
  area: string
  address: string
  mapsUrl: string
  screens: Screen[]
  accessibility: string[]
}

export interface Screen {
  id: string
  name: string
  capacity: number
}

export type SectionKind = 'competition' | 'showcase' | 'special'

export interface Section {
  id: string
  slug: string
  name: string
  kind: SectionKind
  description: string
  /** Hue (0–360) used for section chips and accents. */
  hue: number
}

export type {
  Genre,
  FilmQuery,
  ScreeningQuery,
  CodePurpose,
  SignInInput,
  RequestCodeInput,
  VerifyCodeInput,
  SetPinInput,
  ProfileInput,
  CartLineInput,
  CheckoutInput,
  PaymentInput,
  TicketTransferInput,
  SavedInput,
} from '@afriff/validation'

/** Nigerian (NFVCB-style) age classification. */
export type AgeRating = 'G' | 'PG' | '12' | '15' | '18'

export type PremiereStatus = 'World Premiere' | 'African Premiere' | 'Nigerian Premiere'

export type PosterMotif = 'sun' | 'rays' | 'bands' | 'orb' | 'grid' | 'waves'

/** Parameters for the generated poster art (no image files needed offline). */
export interface PosterArt {
  hue: number
  hue2: number
  motif: PosterMotif
}

export interface Film {
  id: string
  slug: string
  title: string
  logline: string
  synopsis: string
  year: number
  runtimeMin: number
  countries: string[]
  languages: string[]
  genres: Genre[]
  sectionId: string
  rating: AgeRating
  director: string
  cast: string[]
  inCompetition: boolean
  premiere?: PremiereStatus
  featured?: boolean
  poster: PosterArt
}

export type ScreeningFormat = 'Standard' | 'Gala' | 'Outdoor'

export interface Screening {
  id: string
  filmId: string
  venueId: string
  screenId: string
  startsAt: ISODateTime
  endsAt: ISODateTime
  format: ScreeningFormat
  /** Director / cast Q&A after the screening. */
  hasQa: boolean
  capacity: number
  /** Seats already taken. Mock availability until the inventory service exists. */
  sold: number
}

export type EventKind = 'gala' | 'masterclass' | 'panel' | 'awards' | 'social'

export interface FestivalEvent {
  id: string
  slug: string
  kind: EventKind
  title: string
  description: string
  venueId: string
  startsAt: ISODateTime
  endsAt: ISODateTime
  hosts: string[]
  /** The ticket product that grants entry, if entry is ticketed separately. */
  productId?: string
}

// ------------------------------------------------------------------ catalog

export type ProductKind =
  | 'festival_pass'
  | 'day_pass'
  | 'screening'
  | 'masterclass'
  | 'gala'

/**
 * What a product grants entry to. Where there is a choice (which day, which
 * screening, which masterclass) the attendee picks it at purchase time.
 */
export type ProductValidity =
  | { type: 'festival' }
  | { type: 'day' }
  | { type: 'screening' }
  | { type: 'event'; eventKind: EventKind; eventId?: string }

export interface TicketProduct {
  id: string
  slug: string
  kind: ProductKind
  name: string
  summary: string
  price: Money
  perks: string[]
  validity: ProductValidity
  maxPerOrder: number
  /** Remaining stock. `null` means not limited at product level. */
  remaining: number | null
  badge?: string
}

// ------------------------------------------------------------------ account

export interface User {
  id: string
  email: string
  name: string
  phone?: string
  createdAt: ISODateTime
}

/** What a sign-in returns: the bearer token for later calls, plus who it belongs to. */
export interface AuthSession {
  token: string
  user: User
  expiresAt: ISODateTime
}

/** The result of asking for a one-time code, to sign up or to reset a forgotten PIN. */
export interface CodeChallenge {
  email: string
  purpose: CodePurpose
  expiresAt: ISODateTime
  /**
   * Mock mode only: the code the real service would email. The app shows it on
   * screen so the flow can be completed offline. The http adapter never sets this.
   */
  devCode?: string
}

/**
 * Proof that a one-time code was checked. It authorises one call to `setPin`
 * for that email, and nothing else, so a verified address is never left able to
 * do more than the flow that verified it.
 */
export interface VerificationTicket {
  token: string
  email: string
  purpose: CodePurpose
  expiresAt: ISODateTime
  /** The name already on the account, when resetting a PIN. Absent when signing up. */
  name?: string
}

// ------------------------------------------------------------------ orders

export type OrderStatus = 'paid' | 'pending' | 'failed'

export type PaymentMethod = 'card' | 'transfer'

/** What the attendee picked for a product that offers a choice. */
export interface TicketSelection {
  /** Day Pass: which day. */
  day?: ISODate
  /** Single Screening: which screening. */
  screeningId?: string
  /** Masterclass and galas: which event. */
  eventId?: string
}

export interface OrderLine {
  id: string
  productId: string
  productName: string
  kind: ProductKind
  unitPrice: Money
  quantity: number
  selection?: TicketSelection
  /** What was chosen, ready to show: "Salt Roads" or "Day Pass". */
  title: string
  /** Where and when, ready to show: "Tue 3 Nov, 18:30 · Landmark, Cinema 1". */
  detail?: string
}

export interface OrderContact {
  name: string
  email: string
  phone?: string
}

export interface OrderPayment {
  method: PaymentMethod
  /** Card payments only. */
  last4?: string
  /** Transfer reference the attendee quotes, or the bank's reference for a card. */
  reference?: string
  /** Why a payment failed, in words an attendee can act on. */
  failureReason?: string
}

export interface Order {
  id: string
  /** Short human reference, e.g. AF-7KQ2P. */
  reference: string
  status: OrderStatus
  placedAt: ISODateTime
  paidAt?: ISODateTime
  lines: OrderLine[]
  total: Money
  contact: OrderContact
  payment: OrderPayment
  /** Tickets issued once the order is paid. */
  ticketIds: string[]
}

/**
 * Where a ticket stands. `expired` is not among them: it is worked out from the
 * clock by `ticketState`, so a ticket never has to be rewritten to go stale.
 */
export type TicketStatus = 'valid' | 'used' | 'transferred' | 'void'

/** Where a ticket went, on the copy the sender keeps. */
export interface TicketTransfer {
  toEmail: string
  toName?: string
  at: ISODateTime
}

/** Who a ticket came from, on the copy the recipient gets. */
export interface TicketOrigin {
  fromName: string
  at: ISODateTime
}

/**
 * One admission. Everything needed to show and check it is denormalised here,
 * so My tickets works offline without the programme loaded.
 */
export interface Ticket {
  id: string
  /** Printed on the ticket and encoded in its QR code. */
  code: string
  orderId: string
  productId: string
  productName: string
  kind: ProductKind
  status: TicketStatus
  holderName: string
  title: string
  subtitle?: string
  startsAt?: ISODateTime
  endsAt?: ISODateTime
  venueName?: string
  /** Which screen or room, when the venue has more than one. */
  roomName?: string
  selection?: TicketSelection
  issuedAt: ISODateTime
  /** Set once this ticket has been passed on; it stops admitting anyone. */
  transfer?: TicketTransfer
  /** Set on a ticket that arrived from someone else. */
  origin?: TicketOrigin
}

// ------------------------------------------------------------------ my festival

/** What an attendee can put aside: a film to watch out for, or a slot in their week. */
export type SavedKind = 'film' | 'screening' | 'event'

export interface SavedItem {
  kind: SavedKind
  /** The film, screening or event this points at. */
  refId: string
  savedAt: ISODateTime
}

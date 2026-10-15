import type { Genre } from '@afriff/validation'

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
  /** What the venue has, in short lines an attendee can scan before setting off. */
  accessibility: string[]
  /** Anything that needs a sentence rather than a tick: where to ask, what to expect. */
  accessibilityNote?: string
  travel?: VenueTravel
}

/** Getting there, the way someone in Lagos would actually ask about it. */
export interface VenueTravel {
  /** The landmark to aim for, for a driver who does not know the address. */
  landmark?: string
  parking?: string
  dropOff?: string
  /** Buses, ferries, ride-hailing — whatever gets people there without a car. */
  transport?: string
  /** When to leave, given the traffic that venue is known for. */
  timing?: string
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
  SignInInput,
  SignUpInput,
  PasswordResetRequestInput,
  PasswordResetInput,
  ProfileInput,
  CartLineInput,
  CheckoutInput,
  TicketTransferInput,
  SavedInput,
  NotificationKinds,
  DeviceInput,
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
  /** Seats already taken. Kept by the server as tickets are sold. */
  sold: number
  /** Set by the festival team in Ops. A cancelled screening sells nothing and admits nobody. */
  cancelled?: boolean
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
  /** Whether the attendee has opened the confirmation link sent to that address. */
  emailVerified: boolean
  firstName: string
  lastName: string
  /** First and last name together, ready to show. */
  name: string
  phone?: string
  createdAt: ISODateTime
}

/**
 * The answer to "send me a reset link". It looks the same whether or not the
 * email has an account, so the screen cannot be used to find out who does.
 */
export interface PasswordResetChallenge {
  email: string
  /**
   * Mock mode only: the code the reset link would carry. The app offers to open
   * the link on screen, so the flow can be finished offline. Firebase never sets it.
   */
  devCode?: string
}

/** The answer to "send me a confirmation link". */
export interface EmailVerificationChallenge {
  email: string
  /** Mock mode only, as on `PasswordResetChallenge`. */
  devCode?: string
}

// ------------------------------------------------------------------ orders

/**
 * `pending` holds the stock while the attendee pays, until `holdExpiresAt`.
 * `failed` gives it back. Only `paid` issues tickets.
 */
export type OrderStatus = 'paid' | 'pending' | 'failed'

/** Who takes the money. `mock` is the stand-in checkout of the local build. */
export type PaymentProvider = 'paystack' | 'mock'

/** How a payment was made, as the provider reports it. */
export type PaymentChannel = 'card' | 'bank' | 'bank_transfer' | 'ussd' | 'qr' | 'mobile_money' | 'apple_pay' | 'other'

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
  provider: PaymentProvider
  /** The provider's reference for the latest attempt to pay. */
  reference?: string
  /** How it was paid, once it was. */
  channel?: PaymentChannel
  /** Card payments only. */
  last4?: string
  /** Card payments only: "visa", "mastercard", "verve". */
  cardBrand?: string
  /** Why the last attempt failed, in words an attendee can act on. */
  failureReason?: string
}

export interface Order {
  id: string
  /** Short human reference, e.g. AF-7KQ2P. */
  reference: string
  status: OrderStatus
  placedAt: ISODateTime
  paidAt?: ISODateTime
  /** Until when an unpaid order keeps its tickets aside. */
  holdExpiresAt?: ISODateTime
  lines: OrderLine[]
  total: Money
  contact: OrderContact
  payment: OrderPayment
  /** Tickets issued once the order is paid. */
  ticketIds: string[]
}

/**
 * One attempt to pay for an order, opened on the server so the amount cannot be
 * changed on the way. The app hands it to the provider's checkout and then asks
 * `orders.verify` how it went; it never decides the outcome itself.
 */
export interface PaymentIntent {
  orderId: string
  provider: PaymentProvider
  /** The provider's reference for this attempt. */
  reference: string
  /** Opens the provider's checkout inside the app (Paystack `resumeTransaction`). */
  accessCode: string
  /** The provider's own checkout page, for when the in-app one cannot load. */
  authorizationUrl: string
  amount: Money
  email: string
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
  /** Kept alongside the name so a venue notice can be matched with no programme loaded. */
  venueId?: string
  /** Which screen or room, when the venue has more than one. */
  roomName?: string
  selection?: TicketSelection
  issuedAt: ISODateTime
  /** When it was scanned in, for a ticket that admits once. Passes are never used up. */
  usedAt?: ISODateTime
  /** Why a void ticket was cancelled, in words for the holder: "The screening was cancelled." */
  voidReason?: string
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

// ------------------------------------------------------------------ updates

/** What an update is about, which decides its icon and how it reads. */
export type UpdateKind = 'schedule' | 'venue' | 'announcement'

/**
 * How loudly it should land. `urgent` earns a banner when it touches something
 * the attendee holds a ticket for; everything else waits in the inbox.
 */
export type UpdateSeverity = 'normal' | 'urgent'

/** What an update concerns, so the app can tell whose week it changes. */
export interface UpdateSubject {
  screeningId?: string
  eventId?: string
  venueId?: string
  filmId?: string
}

export interface FestivalUpdate {
  id: string
  kind: UpdateKind
  severity: UpdateSeverity
  title: string
  /** One or two sentences, already written for an attendee to act on. */
  body: string
  publishedAt: ISODateTime
  subject?: UpdateSubject
  /** Where to go for the detail, when there is somewhere to go. */
  link?: string
}

// ------------------------------------------------------------------ info

export type FaqTopic = 'tickets' | 'at-the-festival' | 'access' | 'getting-there'

export interface Faq {
  id: string
  topic: FaqTopic
  question: string
  answer: string
  /** Somewhere in the app that answers it better than words can. */
  link?: string
  linkLabel?: string
}

/** A festival rule, in the words an attendee is owed before they buy. */
export interface Policy {
  id: string
  title: string
  body: string
}

export interface ContactInfo {
  email: string
  phone?: string
  whatsapp?: string
  /** When a person is actually there to answer. */
  hours: string
  /** Where to go at the venue itself. */
  inPerson?: string
}

export interface FestivalInfo {
  faqs: Faq[]
  policies: Policy[]
  contact: ContactInfo
}

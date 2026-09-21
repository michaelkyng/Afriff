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

export type { Genre, FilmQuery, ScreeningQuery } from '@afriff/validation'

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

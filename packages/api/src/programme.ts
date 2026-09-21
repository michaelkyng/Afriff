import { formatDay, formatTime, lagosDateKey } from './format'
import type {
  FestivalEvent,
  Film,
  Screen,
  Screening,
  Section,
  TicketProduct,
  Venue,
} from './types'

// ------------------------------------------------------------------ availability

export type AvailabilityStatus = 'available' | 'selling_fast' | 'sold_out'

export interface Availability {
  status: AvailabilityStatus
  seatsLeft: number
}

/** Seats left and a status label. "Selling fast" kicks in at 12% or fewer seats left. */
export function availabilityOf(screening: Pick<Screening, 'capacity' | 'sold'>): Availability {
  const seatsLeft = Math.max(0, screening.capacity - screening.sold)
  if (seatsLeft === 0) return { status: 'sold_out', seatsLeft }
  if (seatsLeft / screening.capacity <= 0.12) return { status: 'selling_fast', seatsLeft }
  return { status: 'available', seatsLeft }
}

// ------------------------------------------------------------------ timeline items

interface ItemBase {
  id: string
  title: string
  startsAt: string
  endsAt: string
  venue: Venue
  /** Screen or room name within the venue. */
  room: string
}

export interface ScreeningItem extends ItemBase {
  kind: 'screening'
  screening: Screening
  film: Film
  section?: Section
  availability: Availability
}

export interface EventItem extends ItemBase {
  kind: 'event'
  event: FestivalEvent
  product?: TicketProduct
}

/** A slot on the festival timeline: a film screening or an event. */
export type ProgrammeItem = ScreeningItem | EventItem

export interface ProgrammeData {
  films: Film[]
  venues: Venue[]
  sections: Section[]
  screenings: Screening[]
  events: FestivalEvent[]
  products: TicketProduct[]
}

export interface ProgrammeLookups {
  film: Map<string, Film>
  venue: Map<string, Venue>
  section: Map<string, Section>
  screen: Map<string, { venue: Venue; screen: Screen }>
  product: Map<string, TicketProduct>
}

export function buildLookups(data: ProgrammeData): ProgrammeLookups {
  return {
    film: new Map(data.films.map((f) => [f.id, f])),
    venue: new Map(data.venues.map((v) => [v.id, v])),
    section: new Map(data.sections.map((s) => [s.id, s])),
    screen: new Map(data.venues.flatMap((venue) => venue.screens.map((screen) => [screen.id, { venue, screen }]))),
    product: new Map(data.products.map((p) => [p.id, p])),
  }
}

/** Screenings and events merged into one list, sorted by start time. */
export function buildTimeline(data: ProgrammeData, lookups: ProgrammeLookups): ProgrammeItem[] {
  const items: ProgrammeItem[] = []

  for (const screening of data.screenings) {
    const film = lookups.film.get(screening.filmId)
    const place = lookups.screen.get(screening.screenId)
    if (!film || !place) continue
    items.push({
      kind: 'screening',
      id: screening.id,
      title: film.title,
      startsAt: screening.startsAt,
      endsAt: screening.endsAt,
      venue: place.venue,
      room: place.screen.name,
      screening,
      film,
      section: lookups.section.get(film.sectionId),
      availability: availabilityOf(screening),
    })
  }

  for (const event of data.events) {
    const venue = lookups.venue.get(event.venueId)
    if (!venue) continue
    items.push({
      kind: 'event',
      id: event.id,
      title: event.title,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      venue,
      room: venue.screens[0]?.name ?? '',
      event,
      product: event.productId ? lookups.product.get(event.productId) : undefined,
    })
  }

  return items.sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.title.localeCompare(b.title))
}

// ------------------------------------------------------------------ time helpers

export function hasEnded(item: Pick<ItemBase, 'endsAt'>, now: Date): boolean {
  return now.getTime() >= Date.parse(item.endsAt)
}

export function isLive(item: Pick<ItemBase, 'startsAt' | 'endsAt'>, now: Date): boolean {
  const t = now.getTime()
  return Date.parse(item.startsAt) <= t && t < Date.parse(item.endsAt)
}

/** 0–1 progress through an item that has started. */
export function progressOf(item: Pick<ItemBase, 'startsAt' | 'endsAt'>, now: Date): number {
  const start = Date.parse(item.startsAt)
  const end = Date.parse(item.endsAt)
  return Math.min(1, Math.max(0, (now.getTime() - start) / (end - start)))
}

/** "in 25 min", "Today, 18:30", "Tomorrow, 11:00" or "Tue 3 Nov, 18:30". */
export function formatStartsIn(startsAt: string, now: Date): string {
  const start = new Date(startsAt)
  const minutes = Math.round((start.getTime() - now.getTime()) / 60_000)
  if (minutes > 0 && minutes < 60) return `in ${minutes} min`
  const startDay = lagosDateKey(start)
  if (startDay === lagosDateKey(now)) return `Today, ${formatTime(start)}`
  if (startDay === lagosDateKey(new Date(now.getTime() + 86_400_000))) return `Tomorrow, ${formatTime(start)}`
  return `${formatDay(start)}, ${formatTime(start)}`
}

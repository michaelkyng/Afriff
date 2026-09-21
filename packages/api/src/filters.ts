import { formatTime } from './format'
import type { Film, Genre } from './types'
import type { ProgrammeItem } from './programme'

export type ProgrammeView = 'schedule' | 'films'

export type TimeOfDay = 'morning' | 'afternoon' | 'evening'

export const TIMES_OF_DAY: { value: TimeOfDay; label: string; hint: string }[] = [
  { value: 'morning', label: 'Morning', hint: 'Before 12:00' },
  { value: 'afternoon', label: 'Afternoon', hint: '12:00–17:00' },
  { value: 'evening', label: 'Evening', hint: 'From 17:00' },
]

/** Everything the programme can be filtered by. Lists are OR within a group, AND across groups. */
export interface ProgrammeFilterState {
  /** Section slugs. */
  sections: string[]
  /** Venue slugs. */
  venues: string[]
  genres: Genre[]
  times: TimeOfDay[]
  languages: string[]
  q: string
}

export const EMPTY_FILTERS: ProgrammeFilterState = {
  sections: [],
  venues: [],
  genres: [],
  times: [],
  languages: [],
  q: '',
}

/** Morning / afternoon / evening, in Lagos time. */
export function timeOfDay(iso: string): TimeOfDay {
  const hour = Number(formatTime(iso).slice(0, 2))
  if (hour < 12) return 'morning'
  if (hour < 17) return 'afternoon'
  return 'evening'
}

/** Lower-case and strip accents so "Àṣẹ" matches "ase". */
export function normaliseText(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

function matchesQuery(haystack: string[], q: string): boolean {
  const terms = normaliseText(q).split(/\s+/).filter(Boolean)
  if (!terms.length) return true
  const text = normaliseText(haystack.join(' '))
  return terms.every((term) => text.includes(term))
}

/** Film-level filters: section, genre, language and search. */
export function filmMatches(film: Film, filters: ProgrammeFilterState, sectionSlug?: string): boolean {
  if (filters.sections.length && (!sectionSlug || !filters.sections.includes(sectionSlug))) return false
  if (filters.genres.length && !film.genres.some((g) => filters.genres.includes(g))) return false
  if (filters.languages.length && !film.languages.some((l) => filters.languages.includes(l))) return false
  return matchesQuery([film.title, film.director, ...film.cast, ...film.countries, ...film.languages, ...film.genres], filters.q)
}

/** Slot-level filters (venue, time of day) plus the film filters for screenings. */
export function itemMatches(item: ProgrammeItem, filters: ProgrammeFilterState): boolean {
  if (filters.venues.length && !filters.venues.includes(item.venue.slug)) return false
  if (filters.times.length && !filters.times.includes(timeOfDay(item.startsAt))) return false
  if (item.kind === 'screening') return filmMatches(item.film, filters, item.section?.slug)
  // Events have no section/genre/language, so film-only filters hide them.
  if (filters.sections.length || filters.genres.length || filters.languages.length) return false
  return matchesQuery([item.event.title, item.event.description, ...item.event.hosts], filters.q)
}

export function activeFilterCount(filters: ProgrammeFilterState): number {
  return (
    filters.sections.length +
    filters.venues.length +
    filters.genres.length +
    filters.times.length +
    filters.languages.length
  )
}

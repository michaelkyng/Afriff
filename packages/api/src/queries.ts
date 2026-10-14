import { filmQuerySchema, screeningQuerySchema } from '@afriff/validation'
import { validationError } from './contract'
import type { Film, FilmQuery, Screening, ScreeningQuery } from './types'

/**
 * The programme queries both adapters answer the same way. The programme is
 * small enough to filter after loading it whole, and a database could not do
 * the accent-insensitive search anyway.
 */

function normalise(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/** Throws `ApiError('validation')` for a malformed query. */
export function selectFilms(films: readonly Film[], query: FilmQuery = {}): Film[] {
  const parsed = filmQuerySchema.safeParse(query)
  if (!parsed.success) throw validationError(parsed.error.issues, 'Invalid film query.')
  const term = query.search ? normalise(query.search.trim()) : ''
  return films.filter((film) => {
    if (query.sectionId && film.sectionId !== query.sectionId) return false
    if (query.genre && !film.genres.includes(query.genre)) return false
    if (query.featured !== undefined && Boolean(film.featured) !== query.featured) return false
    if (term) {
      const haystack = normalise([film.title, film.director, ...film.cast, ...film.countries].join(' '))
      if (!haystack.includes(term)) return false
    }
    return true
  })
}

/** Throws `ApiError('validation')` for a malformed query. */
export function selectScreenings(screenings: readonly Screening[], query: ScreeningQuery = {}): Screening[] {
  const parsed = screeningQuerySchema.safeParse(query)
  if (!parsed.success) throw validationError(parsed.error.issues, 'Invalid screening query.')
  return screenings.filter((screening) => {
    if (query.date && !screening.startsAt.startsWith(query.date)) return false
    if (query.venueId && screening.venueId !== query.venueId) return false
    if (query.filmId && screening.filmId !== query.filmId) return false
    return true
  })
}

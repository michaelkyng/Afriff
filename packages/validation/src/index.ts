import { z } from 'zod'

export const genreSchema = z.enum([
  'Drama', 'Comedy', 'Thriller', 'Romance', 'Documentary',
  'Animation', 'Fantasy', 'Music', 'Family', 'Crime',
])

/** Input rules for the existing programme search; no Vue or Nuxt dependency. */
export const filmQuerySchema = z.object({
  sectionId: z.string().optional(),
  genre: genreSchema.optional(),
  featured: z.boolean().optional(),
  search: z.string().optional(),
})

export const screeningQuerySchema = z.object({
  date: z.iso.date().optional(),
  venueId: z.string().optional(),
  filmId: z.string().optional(),
})

export type Genre = z.infer<typeof genreSchema>
export type FilmQuery = z.infer<typeof filmQuerySchema>
export type ScreeningQuery = z.infer<typeof screeningQuerySchema>

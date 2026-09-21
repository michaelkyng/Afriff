import { describe, expect, test } from 'bun:test'
import { filmQuerySchema, screeningQuerySchema } from '@afriff/validation'

describe('shared programme input validation', () => {
  test('accepts omitted filters and preserves a false featured filter', () => {
    expect(filmQuerySchema.parse({})).toEqual({})
    expect(filmQuerySchema.parse({ search: 'Àṣẹ', genre: 'Drama', featured: false }))
      .toEqual({ search: 'Àṣẹ', genre: 'Drama', featured: false })
  })

  test('rejects invalid genres and string booleans', () => {
    expect(filmQuerySchema.safeParse({ genre: 'Unknown' }).success).toBe(false)
    expect(filmQuerySchema.safeParse({ featured: 'false' }).success).toBe(false)
  })

  test('requires a real calendar date for screening filters', () => {
    expect(screeningQuerySchema.safeParse({ date: '2026-11-01' }).success).toBe(true)
    expect(screeningQuerySchema.safeParse({ date: '2026-02-30' }).success).toBe(false)
    expect(screeningQuerySchema.safeParse({ date: '2026-11-01T18:00:00Z' }).success).toBe(false)
  })
})

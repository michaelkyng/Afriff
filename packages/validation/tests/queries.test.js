import { describe, expect, test } from 'bun:test'
import {
  filmQuerySchema,
  otpCodeSchema,
  pinSchema,
  profileSchema,
  requestCodeSchema,
  screeningQuerySchema,
  setPinSchema,
  signInSchema,
  verifyCodeSchema,
} from '@afriff/validation'

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

describe('shared account input validation', () => {
  test('normalises the email address', () => {
    expect(requestCodeSchema.parse({ email: '  Ada@Example.COM ', purpose: 'signup' }))
      .toEqual({ email: 'ada@example.com', purpose: 'signup' })
    expect(requestCodeSchema.safeParse({ email: 'ada@', purpose: 'signup' }).success).toBe(false)
    expect(requestCodeSchema.safeParse({ email: 'ada@example.com' }).success).toBe(false)
    expect(requestCodeSchema.safeParse({ email: 'ada@example.com', purpose: 'whatever' }).success).toBe(false)
  })

  test('accepts only a six-digit code', () => {
    expect(otpCodeSchema.parse(' 012345 ')).toBe('012345')
    expect(otpCodeSchema.safeParse('12345').success).toBe(false)
    expect(otpCodeSchema.safeParse('12345a').success).toBe(false)
    expect(verifyCodeSchema.parse({ email: 'ADA@example.com', code: '012345' }))
      .toEqual({ email: 'ada@example.com', code: '012345' })
  })

  test('takes the same six digits for a PIN when signing in', () => {
    expect(signInSchema.parse({ email: 'ada@example.com', pin: ' 481902 ' }).pin).toBe('481902')
    expect(signInSchema.safeParse({ email: 'ada@example.com', pin: '4819' }).success).toBe(false)
    expect(pinSchema.safeParse('111111').success).toBe(true)
  })

  test('takes any six digits when a PIN is being chosen', () => {
    for (const pin of ['481902', '000000', '111111', '123456', '654321']) {
      expect(setPinSchema.safeParse({ ticket: 'vrf_1', pin }).success).toBe(true)
    }
    for (const pin of ['', '12345', '1234567', '12345a']) {
      expect(setPinSchema.safeParse({ ticket: 'vrf_1', pin }).success).toBe(false)
    }
  })

  test('takes a first and last name when signing up, and none when resetting a PIN', () => {
    expect(setPinSchema.parse({ ticket: 'vrf_1', pin: '481902' })).not.toHaveProperty('firstName')
    expect(setPinSchema.parse({ ticket: 'vrf_1', pin: '481902', firstName: ' Ada ', lastName: ' Okoye ' }))
      .toMatchObject({ firstName: 'Ada', lastName: 'Okoye' })
    expect(setPinSchema.safeParse({ ticket: 'vrf_1', pin: '481902', firstName: 'Ada', lastName: ' ' }).success).toBe(false)
    expect(setPinSchema.safeParse({ ticket: '', pin: '481902' }).success).toBe(false)
  })

  test('accepts Nigerian phone numbers, and an empty one', () => {
    for (const phone of ['08031234567', '0803 123 4567', '+234 803 123 4567', '234-803-123-4567', '']) {
      expect(profileSchema.safeParse({ firstName: 'Ada', lastName: 'Okoye', phone }).success).toBe(true)
    }
    expect(profileSchema.safeParse({ firstName: 'Ada', lastName: 'Okoye', phone: '123' }).success).toBe(false)
    expect(profileSchema.safeParse({ firstName: 'Ada', lastName: 'Okoye' }).success).toBe(true)
  })
})

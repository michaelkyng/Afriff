import { describe, expect, test } from 'bun:test'
import {
  filmQuerySchema,
  newPinSchema,
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
    // Sign-in checks the shape only: a PIN too weak to choose today still has to work.
    expect(pinSchema.safeParse('111111').success).toBe(true)
  })

  test('turns down a PIN that is too easy to guess when one is being chosen', () => {
    for (const pin of ['481902', '204815', '730264']) {
      expect(newPinSchema.safeParse(pin).success).toBe(true)
    }
    for (const pin of ['000000', '111111', '123456', '654321', '345678']) {
      expect(newPinSchema.safeParse(pin).success).toBe(false)
    }
  })

  test('takes a name when signing up, and none when resetting a PIN', () => {
    expect(setPinSchema.parse({ ticket: 'vrf_1', pin: '481902' }).name).toBeUndefined()
    expect(setPinSchema.parse({ ticket: 'vrf_1', pin: '481902', name: ' Ada Okoye ' }).name).toBe('Ada Okoye')
    expect(setPinSchema.safeParse({ ticket: 'vrf_1', pin: '481902', name: 'A' }).success).toBe(false)
    expect(setPinSchema.safeParse({ ticket: '', pin: '481902' }).success).toBe(false)
  })

  test('accepts Nigerian phone numbers, and an empty one', () => {
    for (const phone of ['08031234567', '0803 123 4567', '+234 803 123 4567', '234-803-123-4567', '']) {
      expect(profileSchema.safeParse({ name: 'Ada Okoye', phone }).success).toBe(true)
    }
    expect(profileSchema.safeParse({ name: 'Ada Okoye', phone: '123' }).success).toBe(false)
    expect(profileSchema.safeParse({ name: 'Ada Okoye' }).success).toBe(true)
  })
})

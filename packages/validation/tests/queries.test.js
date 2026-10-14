import { describe, expect, test } from 'bun:test'
import {
  checkoutSchema,
  filmQuerySchema,
  NIGERIAN_PHONE_PATTERN,
  passwordResetRequestSchema,
  passwordResetSchema,
  passwordSchema,
  profileSchema,
  screeningQuerySchema,
  signInSchema,
  signUpSchema,
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
    expect(passwordResetRequestSchema.parse({ email: '  Ada@Example.COM ' })).toEqual({ email: 'ada@example.com' })
    expect(passwordResetRequestSchema.safeParse({ email: 'ada@' }).success).toBe(false)
    expect(passwordResetRequestSchema.safeParse({}).success).toBe(false)
  })

  test('signing in only needs a password to have been typed, and never trims it', () => {
    expect(signInSchema.parse({ email: 'ADA@example.com', password: ' pass ' }))
      .toEqual({ email: 'ada@example.com', password: ' pass ' })
    expect(signInSchema.safeParse({ email: 'ada@example.com', password: '' }).success).toBe(false)
  })

  test('a chosen password needs at least eight characters, of any kind', () => {
    for (const password of ['harmattan', 'correct horse battery staple', '12345678', 'àṣẹ àṣẹ àṣẹ']) {
      expect(passwordSchema.safeParse(password).success).toBe(true)
    }
    for (const password of ['', 'short', '1234567', 'x'.repeat(129)]) {
      expect(passwordSchema.safeParse(password).success).toBe(false)
    }
  })

  test('signing up takes a first and last name, trimmed', () => {
    expect(signUpSchema.parse({ email: 'ada@example.com', password: 'harmattan', firstName: ' Ada ', lastName: ' Okoye ' }))
      .toMatchObject({ firstName: 'Ada', lastName: 'Okoye' })
    expect(signUpSchema.safeParse({ email: 'ada@example.com', password: 'harmattan', firstName: 'Ada', lastName: ' ' }).success)
      .toBe(false)
    expect(signUpSchema.safeParse({ email: 'ada@example.com', password: 'harmattan', firstName: 'Ada' }).success).toBe(false)
  })

  test('a password reset needs the code from the link and a new password', () => {
    expect(passwordResetSchema.parse({ code: ' oob-123 ', password: 'harmattan' })).toEqual({ code: 'oob-123', password: 'harmattan' })
    expect(passwordResetSchema.safeParse({ code: '', password: 'harmattan' }).success).toBe(false)
    expect(passwordResetSchema.safeParse({ code: 'oob-123', password: 'short' }).success).toBe(false)
  })

  test('accepts Nigerian phone numbers, and an empty one', () => {
    for (const phone of ['08031234567', '0803 123 4567', '+234 803 123 4567', '234-803-123-4567', '0803.123.4567', '']) {
      expect(profileSchema.safeParse({ firstName: 'Ada', lastName: 'Okoye', phone }).success).toBe(true)
    }
    for (const phone of ['123', '0803\t123\t4567', '+44 7700 900123']) {
      expect(profileSchema.safeParse({ firstName: 'Ada', lastName: 'Okoye', phone }).success).toBe(false)
    }
    expect(profileSchema.safeParse({ firstName: 'Ada', lastName: 'Okoye' }).success).toBe(true)
  })

  test('the phone pattern has no backslashes, so the Firestore rules can share it word for word', () => {
    expect(NIGERIAN_PHONE_PATTERN).not.toContain('\\')
  })
})

describe('shared checkout input validation', () => {
  const contact = { name: 'Ada Okoye', email: 'ada@example.com' }

  test('takes the items and who they are for, and no payment details', () => {
    const parsed = checkoutSchema.parse({ items: [{ productId: 'prod_festival_pass', quantity: 1 }], contact })
    expect(parsed).toEqual({ items: [{ productId: 'prod_festival_pass', quantity: 1 }], contact })
    // Card details have no business here: Paystack's checkout takes them.
    const withCard = checkoutSchema.parse({
      items: [{ productId: 'prod_festival_pass', quantity: 1 }],
      contact,
      payment: { method: 'card', cardNumber: '4111111111111111' },
    })
    expect(withCard).not.toHaveProperty('payment')
  })

  test('refuses an empty cart and a bad contact email', () => {
    expect(checkoutSchema.safeParse({ items: [], contact }).success).toBe(false)
    expect(checkoutSchema.safeParse({ items: [{ productId: 'p', quantity: 1 }], contact: { ...contact, email: 'nope' } }).success)
      .toBe(false)
  })
})

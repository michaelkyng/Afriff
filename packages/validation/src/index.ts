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

// ------------------------------------------------------------------ account

/** Emails are stored and compared in lower case, so sign-in is case-insensitive. */
export const emailSchema = z.string().trim().toLowerCase().pipe(z.email())

export const nameSchema = z.string().trim().min(2, 'Enter your name.').max(60)

/** The one-time code that confirms an email address: six digits, entered without spaces. */
export const otpCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, 'Enter the six-digit code.')

/** The PIN that signs an attendee in. Same six digits, different job. */
export const pinSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, 'Your PIN is six digits.')

/** True for digits that climb or fall by one the whole way: 123456, 654321. */
function isRun(pin: string): boolean {
  const steps = [...pin].slice(1).map((digit, index) => Number(digit) - Number(pin[index]))
  return steps.every((step) => step === 1) || steps.every((step) => step === -1)
}

/**
 * A PIN being chosen, as opposed to one being checked: the same six digits,
 * minus the handful anyone guessing would try first.
 */
export const newPinSchema = pinSchema
  .refine((pin) => !/^(\d)\1{5}$/.test(pin), 'Too easy to guess — do not repeat one digit.')
  .refine((pin) => !isRun(pin), 'Too easy to guess — do not use digits in a row.')

/** Why a one-time code was asked for, which decides what verifying it unlocks. */
export const codePurposeSchema = z.enum(['signup', 'reset'])

export const signInSchema = z.object({ email: emailSchema, pin: pinSchema })

export const requestCodeSchema = z.object({ email: emailSchema, purpose: codePurposeSchema })

export const verifyCodeSchema = z.object({ email: emailSchema, code: otpCodeSchema })

/** Finishes a sign-up (which also needs a name) or a PIN reset, against a verified email. */
export const setPinSchema = z.object({
  ticket: z.string().min(1, 'Start again — that verification has gone stale.'),
  pin: newPinSchema,
  /** Set when signing up; a reset already knows whose account it is. */
  name: nameSchema.optional(),
})

/**
 * Nigerian mobile numbers, the way attendees type them: 0803 123 4567,
 * +234 803 123 4567 or 234 803 123 4567. Spaces, dashes and brackets are allowed.
 */
export const phoneSchema = z
  .string()
  .trim()
  .regex(/^(\+?234|0)[\s.-]?\d{3}[\s.-]?\d{3}[\s.-]?\d{3,4}$/, 'Enter a Nigerian phone number, e.g. 0803 123 4567.')

export const profileSchema = z.object({
  name: nameSchema,
  /** Optional: an empty string clears it. */
  phone: z.union([phoneSchema, z.literal('')]).optional(),
})

// ------------------------------------------------------------------ checkout

/** One line of a cart: a product, how many, and whatever choice it needs. */
export const cartLineSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().min(1).max(10),
  selection: z
    .object({
      day: z.iso.date().optional(),
      screeningId: z.string().optional(),
      eventId: z.string().optional(),
    })
    .optional(),
})

export const orderContactSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  phone: z.union([phoneSchema, z.literal('')]).optional(),
})

/**
 * Card details are checked for shape only; nothing is stored beyond the last four
 * digits, and no real payment network is involved while the app is local.
 */
export const paymentSchema = z.discriminatedUnion('method', [
  z.object({
    method: z.literal('card'),
    cardName: nameSchema,
    cardNumber: z
      .string()
      .trim()
      .regex(/^[\d ]{13,23}$/, 'Enter the 16 digits on the card.')
      .refine((value) => value.replace(/\s/g, '').length >= 12, 'Enter the 16 digits on the card.'),
    expiry: z.string().trim().regex(/^(0[1-9]|1[0-2])\/\d{2}$/, 'Use MM/YY.'),
    cvv: z.string().trim().regex(/^\d{3,4}$/, 'Three digits on the back of the card.'),
  }),
  z.object({ method: z.literal('transfer') }),
])

export const checkoutSchema = z.object({
  items: z.array(cartLineSchema).min(1, 'Your cart is empty.').max(20),
  contact: orderContactSchema,
  payment: paymentSchema,
})

// ------------------------------------------------------------------ tickets

/** Passing a ticket on: where it goes, and who to put on it. */
export const ticketTransferSchema = z.object({
  email: emailSchema,
  name: z.union([nameSchema, z.literal('')]).optional(),
})

export type Genre = z.infer<typeof genreSchema>
export type FilmQuery = z.infer<typeof filmQuerySchema>
export type ScreeningQuery = z.infer<typeof screeningQuerySchema>
export type CodePurpose = z.infer<typeof codePurposeSchema>
export type SignInInput = z.input<typeof signInSchema>
export type RequestCodeInput = z.input<typeof requestCodeSchema>
export type VerifyCodeInput = z.input<typeof verifyCodeSchema>
export type SetPinInput = z.input<typeof setPinSchema>
export type ProfileInput = z.input<typeof profileSchema>
export type CartLineInput = z.input<typeof cartLineSchema>
export type OrderContactInput = z.input<typeof orderContactSchema>
export type PaymentInput = z.input<typeof paymentSchema>
export type CheckoutInput = z.input<typeof checkoutSchema>
export type TicketTransferInput = z.input<typeof ticketTransferSchema>

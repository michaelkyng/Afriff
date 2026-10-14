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

/** An account keeps first and last name apart; `nameSchema` is for a full name typed in one go. */
export const firstNameSchema = z.string().trim().min(1, 'Enter your first name.').max(30)

export const lastNameSchema = z.string().trim().min(1, 'Enter your last name.').max(30)

/**
 * A password being chosen. Length is the only rule, the way current guidance has
 * it: a long phrase beats a short string of symbols. Never trimmed, since spaces
 * may be part of it. Firebase also enforces its own minimum on the server.
 */
export const passwordSchema = z
  .string()
  .min(8, 'Use at least 8 characters.')
  .max(128, 'Use 128 characters or fewer.')

/** Signing in only checks that a password was typed; the rules for a good one apply when it is chosen. */
export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password.'),
})

export const signUpSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  firstName: firstNameSchema,
  lastName: lastNameSchema,
})

export const passwordResetRequestSchema = z.object({ email: emailSchema })

/**
 * The code from an emailed link (Firebase calls it an `oobCode`), for a password
 * reset or an email confirmation. Opaque: only its presence is checked here.
 */
export const actionCodeSchema = z.string().trim().min(1, 'That link is incomplete. Open it from the email again.').max(512)

export const passwordResetSchema = z.object({ code: actionCodeSchema, password: passwordSchema })

/**
 * Nigerian mobile numbers, the way attendees type them: 0803 123 4567,
 * +234 803 123 4567 or 234-803-123-4567. Groups may be split by a space, dot or
 * dash. Kept free of backslashes so `firebase/firestore.rules` can use the same
 * pattern word for word.
 */
export const NIGERIAN_PHONE_PATTERN = '^([+]?234|0)[ .-]?[0-9]{3}[ .-]?[0-9]{3}[ .-]?[0-9]{3,4}$'

export const phoneSchema = z
  .string()
  .trim()
  .regex(new RegExp(NIGERIAN_PHONE_PATTERN), 'Enter a Nigerian phone number, e.g. 0803 123 4567.')

export const profileSchema = z.object({
  firstName: firstNameSchema,
  lastName: lastNameSchema,
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
 * What the app sends to place an order. There is no payment in it: the attendee
 * pays in the provider's own checkout (Paystack), so card details never pass
 * through the app or its servers.
 */
export const checkoutSchema = z.object({
  items: z.array(cartLineSchema).min(1, 'Your cart is empty.').max(20),
  contact: orderContactSchema,
})

/** Names one of the attendee's orders, for paying or checking on it. */
export const orderRefSchema = z.object({ orderId: z.string().trim().min(1).max(64) })

// ------------------------------------------------------------------ tickets

/** Passing a ticket on: where it goes, and who to put on it. */
export const ticketTransferSchema = z.object({
  email: emailSchema,
  name: z.union([nameSchema, z.literal('')]).optional(),
})

/** The same, with the ticket it is about, as one request to the server. */
export const ticketTransferRequestSchema = ticketTransferSchema.extend({ ticketId: z.string().trim().min(1).max(64) })

// ------------------------------------------------------------------ door

/** One scan at a door: which session, what was scanned, and (in rehearsal only) the scanner's clock. */
export const checkInSchema = z.object({
  session: z.object({ kind: z.enum(['screening', 'event']), id: z.string().trim().min(1).max(64) }),
  scan: z.string().trim().min(1, 'Scan a ticket or type its code.').max(256),
  at: z.iso.datetime({ offset: true }).optional(),
})

// ------------------------------------------------------------------ my festival

export const savedKindSchema = z.enum(['film', 'screening', 'event'])

/** One thing put aside: which sort of thing, and which one. */
export const savedItemSchema = z.object({
  kind: savedKindSchema,
  refId: z.string().min(1),
})

/** What a device hands over when its saved list meets an account's. */
export const savedMergeSchema = z.array(savedItemSchema).max(200)

export type Genre = z.infer<typeof genreSchema>
export type FilmQuery = z.infer<typeof filmQuerySchema>
export type ScreeningQuery = z.infer<typeof screeningQuerySchema>
export type SignInInput = z.input<typeof signInSchema>
export type SignUpInput = z.input<typeof signUpSchema>
export type PasswordResetRequestInput = z.input<typeof passwordResetRequestSchema>
export type PasswordResetInput = z.input<typeof passwordResetSchema>
export type ProfileInput = z.input<typeof profileSchema>
export type CartLineInput = z.input<typeof cartLineSchema>
export type OrderContactInput = z.input<typeof orderContactSchema>
export type CheckoutInput = z.input<typeof checkoutSchema>
export type OrderRefInput = z.input<typeof orderRefSchema>
export type TicketTransferInput = z.input<typeof ticketTransferSchema>
export type TicketTransferRequestInput = z.input<typeof ticketTransferRequestSchema>
export type SavedInput = z.input<typeof savedItemSchema>
export type CheckInRequestInput = z.input<typeof checkInSchema>

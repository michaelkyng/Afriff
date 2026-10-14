import { setGlobalOptions } from 'firebase-functions'
import { defineSecret, defineString } from 'firebase-functions/params'
import { DEFAULT_FUNCTIONS_REGION } from '@afriff/api/firebase/schema'

/**
 * Configuration for every function. Imported first by each module, so the global
 * options are in place before any function is defined.
 *
 * Parameters come from `apps/functions/.env` (or `.env.<project-id>`), secrets
 * from Secret Manager (`firebase functions:secrets:set`) or, in the emulators,
 * from `.secret.local`. See `firebase/README.md`.
 */

/** Must match `NUXT_PUBLIC_FIREBASE_FUNCTIONS_REGION`, and sit near the Firestore location. */
export const REGION = DEFAULT_FUNCTIONS_REGION

setGlobalOptions({
  region: REGION,
  // A ceiling on surprise bills. Raise per function when the festival needs it.
  maxInstances: 20,
})

/** `sk_live_…` in production, `sk_test_…` everywhere else. Also verifies webhook signatures. */
export const PAYSTACK_SECRET_KEY = defineSecret('PAYSTACK_SECRET_KEY')

export const BREVO_API_KEY = defineSecret('BREVO_API_KEY')

export const APP_URL = defineString('APP_URL', {
  description: 'Public address of the attendee app, without a trailing slash. Paystack returns here and email links point here.',
})

export const MAIL_FROM_EMAIL = defineString('MAIL_FROM_EMAIL', {
  description: 'Sender address for festival email. Must be a sender or domain verified in Brevo.',
})

export const MAIL_FROM_NAME = defineString('MAIL_FROM_NAME', { default: 'AFRIFF' })

export const MAIL_REPLY_TO = defineString('MAIL_REPLY_TO', { default: '' })

/** `log` writes email to the logs instead of sending it: for the emulators, or staging without Brevo. */
export const MAIL_TRANSPORT = defineString('MAIL_TRANSPORT', { default: 'brevo' })

/** The app's address, however the parameter was typed. */
export function appUrl(): string {
  return APP_URL.value().trim().replace(/\/+$/, '')
}

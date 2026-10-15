import { logger } from 'firebase-functions'
import { getMessaging } from 'firebase-admin/messaging'
import type { DocumentReference } from 'firebase-admin/firestore'
import type { PushMessage } from '@afriff/api/push'
import { PUSH_TRANSPORT } from '../env'

/** A device to push to: its token, and its record, to delete if FCM says the token is dead. */
export interface PushTarget {
  ref: DocumentReference
  token: string
}

export interface PushResult {
  sent: number
  removed: number
}

/** FCM's answers that mean the app was uninstalled, the permission withdrawn, or the token replaced. */
const GONE = new Set(['messaging/registration-token-not-registered', 'messaging/invalid-registration-token'])

/**
 * Sends one message to many devices, 500 at a time. Data only, so the app's
 * service worker decides how it shows and where a tap goes. Devices whose
 * token FCM no longer knows are deleted, so the list cleans itself.
 */
export async function pushTo(targets: PushTarget[], message: PushMessage, ttlSeconds: number): Promise<PushResult> {
  if (!targets.length) return { sent: 0, removed: 0 }
  // The emulators have no Cloud Messaging to send through.
  if (PUSH_TRANSPORT.value() === 'log' || process.env.FUNCTIONS_EMULATOR === 'true') {
    logger.info(`Push (not sent) to ${targets.length} device${targets.length === 1 ? '' : 's'}: ${message.title}`, { ...message, devices: targets.slice(0, 20).map((target) => target.ref.path) })
    return { sent: targets.length, removed: 0 }
  }

  const messaging = getMessaging()
  let sent = 0
  let removed = 0
  for (let index = 0; index < targets.length; index += 500) {
    const chunk = targets.slice(index, index + 500)
    const response = await messaging.sendEach(chunk.map((target) => ({
      token: target.token,
      data: { ...message },
      webpush: { headers: { Urgency: 'high', TTL: String(ttlSeconds) } },
    })))
    await Promise.all(response.responses.map(async (result, position) => {
      if (result.success) {
        sent += 1
        return
      }
      if (result.error && GONE.has(result.error.code)) {
        removed += 1
        await chunk[position]!.ref.delete().catch(() => {})
      }
      else logger.warn('Push failed', { code: result.error?.code, message: result.error?.message })
    }))
  }
  return { sent, removed }
}

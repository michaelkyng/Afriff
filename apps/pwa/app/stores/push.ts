import { DEFAULT_KINDS } from '@afriff/api/push'
import type { NotificationKinds } from '@afriff/api'

/** A stable id for this install, so its record is replaced, never duplicated. Push only runs over HTTPS, where `randomUUID` exists. */
function newDeviceId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * Push on this device, kept under `afriff:push`. Like reminders, a property of
 * the phone rather than the account: each device is signed up on its own, with
 * its own choice of what to hear about. `usePush` does the signing up.
 */
export const usePushStore = defineStore(
  'push',
  () => {
    const deviceId = ref('')
    /** The attendee turned push on here, and the server has this device. */
    const enabled = ref(false)
    const kinds = ref<NotificationKinds>({ ...DEFAULT_KINDS })

    function ensureDeviceId(): string {
      if (!deviceId.value) deviceId.value = newDeviceId()
      return deviceId.value
    }

    return { deviceId, enabled, kinds, ensureDeviceId }
  },
  { persist: true },
)

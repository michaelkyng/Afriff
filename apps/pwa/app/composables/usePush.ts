import { isApiError } from '@afriff/api'
import type { NotificationKinds } from '@afriff/api'

/**
 * Where push stands on this device, in the order it is checked:
 * - `unavailable`: nothing sends pushes to this build (the demo, the emulators, no Cloud Messaging config).
 * - `unsupported`: the browser cannot receive them.
 * - `install`: iPhone and iPad only receive them in the app added to the Home Screen (iOS 16.4 and later).
 * - `blocked`: notifications are refused for this site in the browser's settings.
 * - `signed-out`: pushes are about an account's tickets and plan, so they need one.
 * - `ready`: can be turned on, or is on.
 */
export type PushAvailability = 'unavailable' | 'unsupported' | 'install' | 'blocked' | 'signed-out' | 'ready'

/** A reason push cannot be set up that the attendee should read as it is. */
class PushSetupError extends Error {}

/** How long to wait for the service worker before saying so. Only slow on the very first visit. */
const WORKER_TIMEOUT_MS = 10_000

function isAppleMobile(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

function isInstalled(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true
}

function canReceive(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && typeof Notification !== 'undefined'
}

async function serviceWorker(): Promise<ServiceWorkerRegistration> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const late = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new PushSetupError('The app is still being set up on this device. Try again in a moment.')), WORKER_TIMEOUT_MS)
  })
  try {
    return await Promise.race([navigator.serviceWorker.ready, late])
  }
  finally {
    clearTimeout(timer)
  }
}

/**
 * Push notifications on this device: urgent changes to what the attendee holds
 * or saved, reminders for their plan, and festival-wide news, even with the app
 * closed. The server decides what to send (`apps/functions/src/push`); this
 * signs the device up for it under the account, with the reminders it asked
 * for and the kinds it wants, and signs it off again.
 */
export function usePush() {
  const provider = useNuxtApp().$push
  const api = useApi()
  const store = usePushStore()
  const reminders = useRemindersStore()
  const session = useSessionStore()

  const permission = useState<NotificationPermission | 'unsupported'>('push:permission', () =>
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission)
  const busy = useState('push:busy', () => false)
  const error = useState('push:error', () => '')

  const availability = computed<PushAvailability>(() => {
    if (!provider) return 'unavailable'
    if (isAppleMobile() && !isInstalled()) return 'install'
    if (!canReceive()) return 'unsupported'
    if (permission.value === 'denied') return 'blocked'
    if (!session.isSignedIn) return 'signed-out'
    return 'ready'
  })

  /** On, and still allowed: what the rest of the app checks before leaning on push. */
  const active = computed(() => store.enabled && availability.value === 'ready' && permission.value === 'granted')

  /** Gets this browser's token and saves the device, its settings and its reminders. */
  async function register() {
    const tokens = await provider?.()
    if (!tokens) throw new PushSetupError('This browser cannot receive notifications.')
    const token = await tokens.getToken(await serviceWorker())
    await api.notifications.saveDevice({
      deviceId: store.ensureDeviceId(),
      token,
      kinds: { ...store.kinds },
      reminders: reminders.keys.slice(0, 200),
    })
  }

  const describe = (cause: unknown) =>
    isApiError(cause) || cause instanceof PushSetupError
      ? cause.message
      : 'We could not turn on notifications. Check your connection and try again.'

  /** Turns push on. Call it from a click: browsers only ask for permission off one. */
  async function enable(): Promise<boolean> {
    if (busy.value || availability.value !== 'ready') return false
    busy.value = true
    error.value = ''
    try {
      if (Notification.permission !== 'granted') permission.value = await Notification.requestPermission()
      if (permission.value !== 'granted') return false
      await register()
      store.enabled = true
      return true
    }
    catch (cause) {
      error.value = describe(cause)
      return false
    }
    finally {
      busy.value = false
    }
  }

  /** Turns push off: the server forgets this device, and the browser its token. */
  async function disable() {
    if (busy.value) return
    busy.value = true
    error.value = ''
    try {
      if (session.isSignedIn && store.deviceId) await api.notifications.removeDevice(store.deviceId)
      await (await provider?.())?.deleteToken().catch(() => {})
      store.enabled = false
    }
    catch {
      error.value = 'We could not turn off notifications. Check your connection and try again.'
    }
    finally {
      busy.value = false
    }
  }

  async function setKind(kind: keyof NotificationKinds, on: boolean) {
    const before = store.kinds[kind]
    store.kinds = { ...store.kinds, [kind]: on }
    if (!active.value) return
    try {
      await register()
    }
    catch {
      store.kinds = { ...store.kinds, [kind]: before }
      error.value = 'We could not save that. Check your connection and try again.'
    }
  }

  /**
   * Brings the server's copy up to date: a new token, changed reminders. Quiet,
   * since nobody clicked anything; a permission withdrawn in the browser's
   * settings turns push off here too.
   */
  async function sync() {
    if (!store.enabled || typeof Notification === 'undefined') return
    permission.value = Notification.permission
    if (permission.value !== 'granted') {
      store.enabled = false
      return
    }
    if (availability.value !== 'ready') return
    await register().catch(() => {})
  }

  /** Before signing out, while the account can still remove its own device. */
  async function release() {
    if (!store.enabled) return
    await api.notifications.removeDevice(store.deviceId).catch(() => {})
    await forget()
  }

  /**
   * Once the session is gone. The token is dropped, so anything still addressed
   * to it fails and the server deletes the record: the next person to sign in
   * here never gets the last one's notifications.
   */
  async function forget() {
    if (!store.enabled) return
    store.enabled = false
    await (await provider?.().catch(() => null))?.deleteToken().catch(() => {})
  }

  return {
    availability,
    active,
    permission: readonly(permission),
    busy: readonly(busy),
    error,
    kinds: computed(() => store.kinds),
    enable,
    disable,
    setKind,
    sync,
    release,
    forget,
  }
}

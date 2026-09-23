import { formatTime } from '@afriff/api/format'
import type { PlanEntry } from '@afriff/api/plan'

/**
 * Local reminders for the plan.
 *
 * The browser is the only thing that can be asked, and it only answers while the
 * app is open, so this sets a timer per upcoming slot and shows a notification
 * when it comes round. Nothing is scheduled on a server, and nothing survives
 * the tab being closed — which the screen says in as many words.
 */

/** Anything further off than this gets its timer when the attendee comes back. */
const HORIZON_MS = 6 * 60 * 60 * 1000

export function useReminders() {
  const store = useRemindersStore()
  const supported = import.meta.client && typeof Notification !== 'undefined'
  const permission = ref<NotificationPermission | 'unsupported'>(supported ? Notification.permission : 'unsupported')

  /** Browsers only grant this off a real click, so it is asked for on the toggle. */
  async function requestPermission(): Promise<boolean> {
    if (!supported) return false
    if (Notification.permission === 'granted') return true
    if (Notification.permission === 'denied') {
      permission.value = 'denied'
      return false
    }
    permission.value = await Notification.requestPermission()
    return permission.value === 'granted'
  }

  /** Turns a reminder on or off, asking for permission the first time one goes on. */
  async function toggle(key: string): Promise<boolean> {
    if (store.has(key)) return store.toggle(key)
    await requestPermission()
    return store.toggle(key)
  }

  /**
   * Keeps one timer per reminder that is due inside the horizon. Re-running it
   * clears what it set before, so it is safe to call whenever the plan changes.
   */
  function schedule(entries: PlanEntry[]) {
    const timers: ReturnType<typeof setTimeout>[] = []
    if (!supported || Notification.permission !== 'granted') return () => {}

    const now = Date.now()
    for (const entry of entries) {
      if (!store.has(entry.key)) continue
      const fireAt = Date.parse(entry.startsAt) - store.leadMinutes * 60_000
      const delay = fireAt - now
      if (delay <= 0 || delay > HORIZON_MS) continue
      timers.push(
        setTimeout(() => {
          try {
            // eslint-disable-next-line no-new
            new Notification(entry.item.title, {
              body: `Starts at ${formatTime(entry.startsAt)} · ${entry.item.venue.shortName}`,
              tag: entry.key,
            })
          }
          catch {
            // Some browsers refuse outside a service worker; the plan still shows the time.
          }
        }, delay),
      )
    }

    return () => timers.forEach(clearTimeout)
  }

  return { supported, permission, requestPermission, toggle, schedule, store }
}

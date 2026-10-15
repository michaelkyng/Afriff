import { formatTime } from './format'
import type { FestivalUpdate, NotificationKinds, Ticket } from './types'

/**
 * Push notifications: what gets pushed, to whom, and what it says. Shared by
 * the Cloud Functions that send them and the tests, so the rules are written
 * once. No SDK here; the functions do the sending.
 */

/** What a device that turns push on gets, until it says otherwise. */
export const DEFAULT_KINDS: NotificationKinds = { changes: true, reminders: true, festival: true }

/** How long before a slot its reminder arrives. */
export const REMINDER_LEAD_MINUTES = 30

/** How often the reminder job runs; the window it looks at is this wide either side of the lead. */
export const REMINDER_STEP_MINUTES = 5

/**
 * How long after it is published an update may still be pushed. Long enough for
 * a scheduled run that started late; short enough that loading the programme,
 * or a deploy mid-festival, never pushes old news.
 */
export const PUSH_FRESH_MS = 30 * 60_000

/** What one notification says, and where tapping it goes (a path in the app). */
export interface PushMessage {
  title: string
  body: string
  url: string
  /** Replaces an earlier notification with the same tag rather than stacking. */
  tag: string
}

/** Only urgent updates interrupt anyone, once they are out, and only while they are news. */
export function shouldPushUpdate(update: Pick<FestivalUpdate, 'severity' | 'publishedAt'>, now: Date): boolean {
  if (update.severity !== 'urgent') return false
  const age = now.getTime() - Date.parse(update.publishedAt)
  return age >= 0 && age <= PUSH_FRESH_MS
}

/** An update about something goes to the people it touches; one about nothing in particular, to everyone who wants festival news. */
export function audienceOf(update: Pick<FestivalUpdate, 'subject'>): 'affected' | 'everyone' {
  const subject = update.subject
  return subject && Object.values(subject).some(Boolean) ? 'affected' : 'everyone'
}

/** Which device setting an update's push answers to. */
export function kindForUpdate(update: Pick<FestivalUpdate, 'subject'>): keyof NotificationKinds {
  return audienceOf(update) === 'affected' ? 'changes' : 'festival'
}

/**
 * Whether a ticket ties its holder to an update about it: the same rule as
 * "Affects you" in the app (a void ticket counts, since a cancellation voids
 * them), except that nobody is pushed about something already over.
 */
export function ticketTiesHolder(ticket: Pick<Ticket, 'status' | 'startsAt' | 'endsAt'>, now: Date): boolean {
  if (ticket.status !== 'valid' && ticket.status !== 'void') return false
  const ends = ticket.endsAt ?? ticket.startsAt
  return !ends || Date.parse(ends) > now.getTime()
}

const clip = (text: string, length: number) => (text.length <= length ? text : `${text.slice(0, length - 1).trimEnd()}…`)

export function updatePush(update: Pick<FestivalUpdate, 'id' | 'title' | 'body' | 'link'>): PushMessage {
  return { title: clip(update.title, 80), body: clip(update.body, 180), url: update.link ?? '/updates', tag: `update:${update.id}` }
}

/**
 * The slots whose reminders this run sends: starting between lead minus one step
 * and lead plus one step from now. Each slot falls in two consecutive runs, and
 * a log of what was sent keeps it to one notification, so a late or skipped run
 * still reminds everyone.
 */
export function reminderWindow(now: Date): { from: Date; to: Date } {
  const lead = REMINDER_LEAD_MINUTES * 60_000
  const step = REMINDER_STEP_MINUTES * 60_000
  return { from: new Date(now.getTime() + lead - step), to: new Date(now.getTime() + lead + step) }
}

/** How long FCM should keep trying a reminder: until the slot starts, and never less than a minute. */
export function reminderTtlSeconds(startsAt: string, now: Date): number {
  return Math.max(60, Math.floor((Date.parse(startsAt) - now.getTime()) / 1000))
}

export function reminderPush(slot: { key: string; title: string; startsAt: string; place: string }): PushMessage {
  return {
    title: clip(slot.title, 80),
    body: `Starts at ${formatTime(slot.startsAt)} · ${slot.place}`,
    url: '/my-festival',
    tag: `reminder:${slot.key}`,
  }
}

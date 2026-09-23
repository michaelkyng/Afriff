import { lagosDateKey } from './format'
import type { ProgrammeItem } from './programme'
import type { ISODate, SavedItem, Ticket } from './types'

/**
 * An attendee's own week.
 *
 * Two things end up on it: what they have a ticket for, and what they have saved
 * to be at. Both point at the same screenings and events, so the work here is
 * merging them into one list per slot, grouping it by day, and pointing out
 * where the plan cannot actually be kept.
 */

/** Why a slot is on the plan. A ticket outranks a save for the same slot. */
export type PlanSource = 'ticket' | 'saved'

export interface PlanEntry {
  /** Unique per slot: `screening:scn_x` or `event:evt_y`. */
  key: string
  kind: 'screening' | 'event'
  source: PlanSource
  item: ProgrammeItem
  startsAt: string
  endsAt: string
  /** The ticket that admits them, when they have one. */
  ticket?: Ticket
}

export interface PlanDay {
  date: ISODate
  entries: PlanEntry[]
}

/** Why two slots cannot both be kept, or only just. */
export type PlanWarningKind = 'clash' | 'tight'

export interface PlanWarning {
  kind: PlanWarningKind
  a: PlanEntry
  b: PlanEntry
  /** Minutes between the end of the first and the start of the second, for a tight one. */
  gapMinutes?: number
}

/** How long a dash across Lagos needs to be believable. */
export const TRAVEL_MINUTES = 45

const minutes = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 60_000)

/** The day a slot belongs to, in Lagos, where the festival is. */
export function planDate(startsAt: string): ISODate {
  return lagosDateKey(startsAt)
}

export function planKey(kind: 'screening' | 'event', refId: string): string {
  return `${kind}:${refId}`
}

/**
 * Everything the attendee means to be at, in time order.
 *
 * Tickets come first so a slot that is both bought and saved shows as bought.
 * Anything the programme no longer has — a cancelled screening, a pass with no
 * time of its own — is left out.
 */
export function buildPlan(timeline: ProgrammeItem[], tickets: Ticket[], saved: SavedItem[]): PlanEntry[] {
  const byId = new Map(timeline.map((item) => [`${item.kind}:${item.id}`, item]))
  const entries = new Map<string, PlanEntry>()

  const put = (kind: 'screening' | 'event', refId: string, source: PlanSource, ticket?: Ticket) => {
    const key = planKey(kind, refId)
    const item = byId.get(key)
    if (!item) return
    const existing = entries.get(key)
    if (existing && existing.source === 'ticket') return
    entries.set(key, { key, kind, source, item, startsAt: item.startsAt, endsAt: item.endsAt, ticket })
  }

  for (const ticket of tickets) {
    if (ticket.status !== 'valid') continue
    if (ticket.selection?.screeningId) put('screening', ticket.selection.screeningId, 'ticket', ticket)
    else if (ticket.selection?.eventId) put('event', ticket.selection.eventId, 'ticket', ticket)
  }

  for (const item of saved) {
    if (item.kind === 'screening') put('screening', item.refId, 'saved')
    else if (item.kind === 'event') put('event', item.refId, 'saved')
  }

  return [...entries.values()].sort(
    (a, b) => a.startsAt.localeCompare(b.startsAt) || a.item.title.localeCompare(b.item.title),
  )
}

/** The plan split into festival days, each still in time order. */
export function groupPlanByDay(entries: PlanEntry[]): PlanDay[] {
  const days = new Map<ISODate, PlanEntry[]>()
  for (const entry of entries) {
    const date = planDate(entry.startsAt)
    const list = days.get(date)
    if (list) list.push(entry)
    else days.set(date, [entry])
  }
  return [...days.entries()]
    .map(([date, list]) => ({ date, entries: list }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

/** True when two slots run over each other at all. Back to back is not a clash. */
export function overlaps(a: Pick<PlanEntry, 'startsAt' | 'endsAt'>, b: Pick<PlanEntry, 'startsAt' | 'endsAt'>): boolean {
  return Date.parse(a.startsAt) < Date.parse(b.endsAt) && Date.parse(b.startsAt) < Date.parse(a.endsAt)
}

/**
 * Where the plan does not work.
 *
 * A clash is two slots running over each other. A tight one is two slots at
 * different venues with less than {@link TRAVEL_MINUTES} between them, which on
 * a Lagos evening is optimistic. Only neighbouring pairs are compared, so one
 * long slot does not report against everything after it.
 */
export function planWarnings(entries: PlanEntry[]): PlanWarning[] {
  const warnings: PlanWarning[] = []
  const ordered = [...entries].sort((a, b) => a.startsAt.localeCompare(b.startsAt))

  for (let i = 0; i < ordered.length; i += 1) {
    const a = ordered[i]!
    for (let j = i + 1; j < ordered.length; j += 1) {
      const b = ordered[j]!
      if (overlaps(a, b)) {
        warnings.push({ kind: 'clash', a, b })
        continue
      }
      // Sorted by start, so nothing further along can overlap this one either.
      if (Date.parse(b.startsAt) >= Date.parse(a.endsAt)) {
        const gapMinutes = minutes(a.endsAt, b.startsAt)
        if (gapMinutes < TRAVEL_MINUTES && a.item.venue.id !== b.item.venue.id) {
          warnings.push({ kind: 'tight', a, b, gapMinutes })
        }
        break
      }
    }
  }

  return warnings
}

/**
 * What each flagged slot is flagged for, for marking the rows it belongs to.
 * A clash outranks a tight connection, since it is the worse news.
 */
export function warningsByKey(warnings: PlanWarning[]): Map<string, PlanWarningKind> {
  const marks = new Map<string, PlanWarningKind>()
  for (const warning of warnings) {
    for (const entry of [warning.a, warning.b]) {
      if (warning.kind === 'clash' || !marks.has(entry.key)) marks.set(entry.key, warning.kind)
    }
  }
  return marks
}

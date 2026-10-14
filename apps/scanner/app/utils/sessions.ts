import { doorsOpenAt } from '@afriff/api/door'
import type { DoorCount, DoorSession } from '@afriff/api/door'
import { lagosDateKey } from '@afriff/api/format'

export type SessionState = 'open' | 'upcoming' | 'ended'

/** Open from an hour before the start until the end; the same window the server checks. */
export function sessionState(session: Pick<DoorSession, 'startsAt' | 'endsAt'>, now: Date): SessionState {
  if (now < doorsOpenAt(session)) return 'upcoming'
  if (now.getTime() > Date.parse(session.endsAt)) return 'ended'
  return 'open'
}

/** The festival days that have sessions, in order, as Lagos dates. */
export function sessionDays(sessions: readonly DoorSession[]): string[] {
  return [...new Set(sessions.map((session) => lagosDateKey(session.startsAt)))].sort()
}

/** Today if the festival is on, else the next day it is, else its last day. */
export function defaultDay(days: readonly string[], now: Date): string | undefined {
  const today = lagosDateKey(now)
  return days.find((day) => day >= today) ?? days.at(-1)
}

export interface SessionGroups {
  open: DoorSession[]
  upcoming: DoorSession[]
  ended: DoorSession[]
}

/** One day's sessions at the chosen venues, matching a search, split by whether their doors are open. */
export function groupSessions(
  sessions: readonly DoorSession[],
  { day, venueIds, search, now }: { day?: string; venueIds: readonly string[]; search: string; now: Date },
): SessionGroups {
  const term = search.trim().toLowerCase()
  const groups: SessionGroups = { open: [], upcoming: [], ended: [] }
  for (const session of sessions) {
    if (day && lagosDateKey(session.startsAt) !== day) continue
    if (venueIds.length && !venueIds.includes(session.venueId)) continue
    if (term && !`${session.title} ${session.place}`.toLowerCase().includes(term)) continue
    groups[sessionState(session, now)].push(session)
  }
  return groups
}

/** "42 / 60" for a screening's seats, "42 in" for an event. */
export function countLabel(count: DoorCount, session: Pick<DoorSession, 'capacity'>): string {
  return session.capacity === null ? `${count.admitted} in` : `${count.admitted} / ${session.capacity}`
}

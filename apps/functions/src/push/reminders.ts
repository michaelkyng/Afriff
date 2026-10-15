import { logger } from 'firebase-functions'
import { onSchedule } from 'firebase-functions/scheduler'
import type { DocumentReference } from 'firebase-admin/firestore'
import { COLLECTIONS } from '@afriff/api/firebase/schema'
import type { DeviceDoc, PushLogDoc } from '@afriff/api/firebase/schema'
import { toLagosIso } from '@afriff/api/ops'
import { planKey } from '@afriff/api/plan'
import { reminderPush, reminderTtlSeconds, reminderWindow } from '@afriff/api/push'
import type { Film, FestivalEvent, Screening, Venue } from '@afriff/api/types'
import { db } from '../admin'
import { pushTo } from './send'
import type { PushTarget } from './send'

interface Slot {
  key: string
  title: string
  startsAt: string
  place: string
}

/** The screenings and events starting inside this run's window. The programme is written in Lagos time, so the range is too. */
async function slotsStarting(now: Date): Promise<Slot[]> {
  const { from, to } = reminderWindow(now)
  const inWindow = (collection: string) => db.collection(collection)
    .where('startsAt', '>=', toLagosIso(from.getTime()))
    .where('startsAt', '<', toLagosIso(to.getTime()))
    .get()
  const [screenings, events] = await Promise.all([inWindow(COLLECTIONS.screenings), inWindow(COLLECTIONS.events)])
  if (screenings.empty && events.empty) return []

  const venues = new Map((await db.collection(COLLECTIONS.venues).get()).docs.map((doc) => [doc.id, doc.data() as Venue]))
  const place = (venueId: string) => venues.get(venueId)?.shortName ?? ''
  const live = screenings.docs.map((doc) => doc.data() as Screening).filter((screening) => !screening.cancelled)
  const filmIds = [...new Set(live.map((screening) => screening.filmId))]
  const films = filmIds.length ? await db.getAll(...filmIds.map((id) => db.collection(COLLECTIONS.films).doc(id))) : []
  const titles = new Map(films.map((doc) => [doc.id, (doc.data() as Film | undefined)?.title]))

  return [
    ...live.map((screening) => ({
      key: planKey('screening', screening.id),
      title: titles.get(screening.filmId) ?? 'Your screening',
      startsAt: screening.startsAt,
      place: place(screening.venueId),
    })),
    ...events.docs.map((doc) => doc.data() as FestivalEvent).map((festivalEvent) => ({
      key: planKey('event', festivalEvent.id),
      title: festivalEvent.title,
      startsAt: festivalEvent.startsAt,
      place: place(festivalEvent.venueId),
    })),
  ]
}

/**
 * Reminds every device that asked, about each slot starting in about half an
 * hour. A slot falls inside two runs in a row, and the log keeps each device
 * to one reminder per slot, so a late or missed run still reminds everyone.
 */
export async function runReminders(now: Date): Promise<{ slots: number; sent: number; removed: number }> {
  const totals = { slots: 0, sent: 0, removed: 0 }
  for (const slot of await slotsStarting(now)) {
    const asked = await db.collectionGroup(COLLECTIONS.devices).where('reminders', 'array-contains', slot.key).get()
    const wanting = asked.docs.filter((doc) => (doc.data() as DeviceDoc).kinds?.reminders)
    if (!wanting.length) continue

    const logOf = (device: DocumentReference) =>
      db.collection(COLLECTIONS.pushLog).doc(`reminder_${slot.key.replace(':', '-')}_${device.parent.parent!.id}_${device.id}`)
    const logs = await db.getAll(...wanting.map((doc) => logOf(doc.ref)))
    const due = wanting.filter((_, index) => !logs[index]!.exists)
    if (!due.length) continue

    const targets: PushTarget[] = due.map((doc) => ({ ref: doc.ref, token: (doc.data() as DeviceDoc).token }))
    const result = await pushTo(targets, reminderPush(slot), reminderTtlSeconds(slot.startsAt, now))

    const writer = db.bulkWriter()
    const entry: PushLogDoc = { kind: 'reminder', at: now.toISOString(), slot: slot.key }
    for (const doc of due) writer.set(logOf(doc.ref), entry)
    await writer.close()

    totals.slots += 1
    totals.sent += result.sent
    totals.removed += result.removed
  }
  return totals
}

export const sendReminders = onSchedule(
  { schedule: 'every 5 minutes', timeZone: 'Africa/Lagos' },
  async () => {
    const totals = await runReminders(new Date())
    if (totals.slots) logger.info('Sent reminders', totals)
  },
)

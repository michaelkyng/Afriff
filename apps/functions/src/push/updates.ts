import { logger } from 'firebase-functions'
import { onDocumentWritten } from 'firebase-functions/firestore'
import { onSchedule } from 'firebase-functions/scheduler'
import type { DocumentSnapshot } from 'firebase-admin/firestore'
import { COLLECTIONS } from '@afriff/api/firebase/schema'
import type { DeviceDoc, PushLogDoc, SavedDoc, TicketDoc } from '@afriff/api/firebase/schema'
import { audienceOf, kindForUpdate, PUSH_FRESH_MS, shouldPushUpdate, ticketTiesHolder, updatePush } from '@afriff/api/push'
import type { FestivalUpdate, SavedKind, UpdateSubject } from '@afriff/api/types'
import { collections, db } from '../admin'
import { pushTo } from './send'
import type { PushResult, PushTarget } from './send'

/** The attendees an update is about: who holds a ticket for it, or saved it. Matches "Affects you" in the app. */
async function affectedUsers(subject: UpdateSubject, now: Date): Promise<Set<string>> {
  const uids = new Set<string>()

  const holders = async (field: string, value: string) => {
    const tickets = await collections.tickets().where(field, '==', value).get()
    for (const doc of tickets.docs) {
      const ticket = doc.data() as TicketDoc
      if (ticket.userId && ticketTiesHolder(ticket, now)) uids.add(ticket.userId)
    }
  }
  const savers = async (kind: SavedKind, refId: string) => {
    const saved = await db.collectionGroup(COLLECTIONS.saved).where('refId', '==', refId).get()
    for (const doc of saved.docs) {
      const uid = doc.ref.parent.parent?.id
      if (uid && (doc.data() as SavedDoc).kind === kind) uids.add(uid)
    }
  }

  await Promise.all([
    subject.screeningId && holders('selection.screeningId', subject.screeningId),
    subject.screeningId && savers('screening', subject.screeningId),
    subject.eventId && holders('selection.eventId', subject.eventId),
    subject.eventId && savers('event', subject.eventId),
    subject.venueId && holders('venueId', subject.venueId),
    subject.filmId && savers('film', subject.filmId),
  ])
  return uids
}

const target = (doc: DocumentSnapshot): PushTarget => ({ ref: doc.ref, token: (doc.data() as DeviceDoc).token })

/** Every device that wants this update, once per token (two accounts on one browser share one). */
export async function updateTargets(update: FestivalUpdate, now: Date): Promise<PushTarget[]> {
  const kind = kindForUpdate(update)
  let devices: DocumentSnapshot[]
  if (audienceOf(update) === 'everyone') {
    devices = (await db.collectionGroup(COLLECTIONS.devices).where(`kinds.${kind}`, '==', true).get()).docs
  }
  else {
    devices = []
    const uids = [...await affectedUsers(update.subject!, now)]
    for (let index = 0; index < uids.length; index += 100) {
      const lists = await Promise.all(uids.slice(index, index + 100).map((uid) => collections.users().doc(uid).collection(COLLECTIONS.devices).get()))
      for (const list of lists) devices.push(...list.docs.filter((doc) => (doc.data() as DeviceDoc).kinds?.[kind]))
    }
  }
  const byToken = new Map(devices.map((doc) => [(doc.data() as DeviceDoc).token, target(doc)]))
  return [...byToken.values()]
}

const alreadyExists = (error: unknown) => (error as { code?: unknown })?.code === 6

/**
 * Pushes one update, if it should go at all and has not gone already. The log
 * entry is claimed with `create`, which only one caller can win, so the trigger
 * and the schedule can both try without anyone hearing it twice. An edit to an
 * update that has gone out does not send it again.
 */
export async function pushUpdate(update: FestivalUpdate, now: Date): Promise<PushResult | null> {
  if (!shouldPushUpdate(update, now)) return null
  const log = db.collection(COLLECTIONS.pushLog).doc(`update_${update.id}`)
  const claim: PushLogDoc = { kind: 'update', at: now.toISOString(), devices: 0, sent: 0, removed: 0 }
  try {
    await log.create(claim)
  }
  catch (error) {
    if (alreadyExists(error)) return null
    throw error
  }

  const targets = await updateTargets(update, now)
  const result = await pushTo(targets, updatePush(update), PUSH_FRESH_MS / 1000)
  await log.update({ devices: targets.length, sent: result.sent, removed: result.removed })
  logger.info(`Pushed "${update.title}"`, { updateId: update.id, devices: targets.length, ...result })
  return result
}

/** An urgent update published now goes out as soon as it is written. */
export const pushUpdates = onDocumentWritten(`${COLLECTIONS.updates}/{updateId}`, async (event) => {
  const update = event.data?.after.data() as FestivalUpdate | undefined
  if (update) await pushUpdate(update, new Date())
})

/**
 * Pushes the urgent updates whose time has come and that have not gone yet.
 * There are few urgent updates, so they are all read and the clock decides.
 */
export async function pushDueUpdates(now: Date): Promise<number> {
  const urgent = await db.collection(COLLECTIONS.updates).where('severity', '==', 'urgent').get()
  let pushed = 0
  for (const doc of urgent.docs) {
    try {
      if (await pushUpdate(doc.data() as FestivalUpdate, now)) pushed += 1
    }
    catch (error) {
      logger.error('Could not push an update', { updateId: doc.id, error })
    }
  }
  return pushed
}

/** One scheduled for later goes out when its time comes, within five minutes. */
export const pushScheduledUpdates = onSchedule(
  { schedule: 'every 5 minutes', timeZone: 'Africa/Lagos' },
  async () => {
    await pushDueUpdates(new Date())
  },
)

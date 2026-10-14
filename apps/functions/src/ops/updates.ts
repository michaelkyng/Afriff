import { ApiError } from '@afriff/api'
import { COLLECTIONS } from '@afriff/api/firebase/schema'
import type { MailDoc, OrderDoc, TicketDoc } from '@afriff/api/firebase/schema'
import type { DeleteUpdateInput, PublishUpdateInput } from '@afriff/api/ops'
import { randomCode, withoutUndefined } from '@afriff/api/orders'
import type { FestivalUpdate, Screening } from '@afriff/api/types'
import { collections, db } from '../admin'
import { updateNoticeMail } from '../mail/templates'
import { audit } from './context'
import type { Who } from './context'

/** A ceiling on one update's email, so a mistake cannot mail the whole festival. */
const MAX_EMAILS = 5000

/** The contact emails on orders holding a ticket for a screening or event, once each. */
async function ticketHolderEmails(subject: FestivalUpdate['subject']): Promise<{ email: string; name: string }[]> {
  const field = subject?.screeningId ? 'selection.screeningId' : subject?.eventId ? 'selection.eventId' : null
  const value = subject?.screeningId ?? subject?.eventId
  if (!field || !value) return []
  const tickets = await collections.tickets().where(field, '==', value).get()
  // For a cancelled screening the tickets are already void, and their holders are the ones to tell.
  const cancelled = subject?.screeningId
    ? Boolean(((await db.collection(COLLECTIONS.screenings).doc(subject.screeningId).get()).data() as Screening | undefined)?.cancelled)
    : false
  const holding = (ticket: TicketDoc) => ticket.status === 'valid' || (cancelled && ticket.status === 'void')
  const orderIds = [...new Set(tickets.docs.map((doc) => doc.data() as TicketDoc).filter(holding).map((ticket) => ticket.orderId))]
  const recipients = new Map<string, string>()
  for (let index = 0; index < orderIds.length; index += 300) {
    const orders = await db.getAll(...orderIds.slice(index, index + 300).map((id) => collections.orders().doc(id)))
    for (const doc of orders) {
      const order = doc.data() as OrderDoc | undefined
      if (order) recipients.set(order.contact.email, order.contact.name)
    }
  }
  return [...recipients].map(([email, name]) => ({ email, name }))
}

export async function publishUpdate(input: PublishUpdateInput, who: Who): Promise<{ update: FestivalUpdate; emailed: number }> {
  const id = input.id ?? `upd_${randomCode(10).toLowerCase()}`
  const ref = db.collection(COLLECTIONS.updates).doc(id)
  if (input.id && !(await ref.get()).exists) throw new ApiError('not_found', 'That update no longer exists.', { id })

  const subject = input.subject && Object.values(input.subject).some(Boolean) ? withoutUndefined(input.subject) : undefined
  const update: FestivalUpdate = withoutUndefined({
    id,
    kind: input.kind,
    severity: input.severity,
    title: input.title,
    body: input.body,
    publishedAt: input.publishAt ?? who.now.toISOString(),
    subject,
    link: input.link,
  })
  await ref.set(update)

  let emailed = 0
  if (input.emailTicketHolders) {
    const recipients = await ticketHolderEmails(subject)
    if (recipients.length > MAX_EMAILS) {
      throw new ApiError('validation', `That would email ${recipients.length} people. Ask a developer to send it in parts.`)
    }
    const writer = db.bulkWriter()
    for (const recipient of recipients) {
      const mail: MailDoc = {
        ...updateNoticeMail(recipient, update),
        status: 'queued',
        attempts: 0,
        createdAt: who.now.toISOString(),
      }
      writer.create(collections.mail().doc(), mail)
    }
    await writer.close()
    emailed = recipients.length
  }

  await audit(null, who, 'publishUpdate', `${input.id ? 'Edited' : 'Published'} "${update.title}"${emailed ? `, emailed to ${emailed === 1 ? '1 person' : `${emailed} people`}` : ''}`, { kind: 'update', id })
  return { update, emailed }
}

export async function deleteUpdate(input: DeleteUpdateInput, who: Who): Promise<{ id: string }> {
  const ref = db.collection(COLLECTIONS.updates).doc(input.id)
  const existing = (await ref.get()).data() as FestivalUpdate | undefined
  if (!existing) throw new ApiError('not_found', 'That update no longer exists.', { id: input.id })
  const batch = db.batch()
  batch.delete(ref)
  audit(batch, who, 'deleteUpdate', `Deleted "${existing.title}"`, { kind: 'update', id: input.id })
  await batch.commit()
  return { id: input.id }
}

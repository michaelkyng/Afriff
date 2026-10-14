import { FieldValue } from 'firebase-admin/firestore'
import { ApiError } from '@afriff/api'
import type { MailDoc, TicketDoc, UserDoc } from '@afriff/api/firebase/schema'
import { newId, withoutUndefined } from '@afriff/api/orders'
import type { Ticket } from '@afriff/api/types'
import { ticketTransferRequestSchema } from '@afriff/validation'
import { adminAuth, collections, db } from './admin'
import { callable, parse } from './callable'
import { ticketReceivedMail } from './mail/templates'

/**
 * Passing a ticket on, and picking up tickets that were passed on before the
 * recipient had an account. The app has the "Pass it on" button switched off
 * for now (see the roadmap's "Parked for later"); the server side is complete so
 * it can come back without backend work.
 */

function toTicket({ userId: _u, claimEmail: _c, ...ticket }: TicketDoc): Ticket {
  return ticket
}

async function uidForEmail(email: string): Promise<string | null> {
  try {
    return (await adminAuth.getUserByEmail(email)).uid
  }
  catch (error) {
    if ((error as { code?: string }).code === 'auth/user-not-found') return null
    throw error
  }
}

export const transferTicket = callable<'transferTicket'>({}, async (data, caller) => {
  const { ticketId, email, name } = parse(ticketTransferRequestSchema, data, 'Check the email address.')
  if (email === caller.email?.toLowerCase()) throw new ApiError('validation', 'That is your own address.', { field: 'email' })

  const [recipient, profile] = await Promise.all([
    uidForEmail(email),
    collections.users().doc(caller.uid).get(),
  ])
  const fromName = (profile.data() as UserDoc | undefined)?.name ?? 'Someone'
  const ref = collections.tickets().doc(ticketId)

  const sent = await db.runTransaction(async (tx) => {
    const ticket = (await tx.get(ref)).data() as TicketDoc | undefined
    if (!ticket || ticket.userId !== caller.uid) throw new ApiError('not_found', 'We could not find that ticket.', { ticketId })
    if (ticket.status === 'transferred') throw new ApiError('conflict', 'You have already passed this ticket on.', { ticketId })
    if (ticket.status !== 'valid') throw new ApiError('conflict', 'That ticket can no longer be passed on.', { ticketId })
    const ends = ticket.endsAt ?? ticket.startsAt
    if (ends && Date.parse(ends) < Date.now()) throw new ApiError('conflict', 'That screening is over.', { ticketId })

    const at = new Date().toISOString()
    const toName = name?.trim() || undefined
    const { transfer: _transfer, claimEmail: _claim, ...rest } = ticket
    const copy: TicketDoc = withoutUndefined({
      ...rest,
      id: newId.ticket(),
      code: newId.ticketCode(),
      userId: recipient,
      // Nobody with that email yet: it waits for them, for a confirmed address only.
      claimEmail: recipient ? undefined : email,
      holderName: toName ?? email,
      issuedAt: at,
      origin: { fromName, at },
    })
    const transfer = withoutUndefined({ toEmail: email, toName, at })
    tx.create(collections.tickets().doc(copy.id), copy)
    tx.update(ref, { status: 'transferred', transfer })
    const mail: MailDoc = {
      ...ticketReceivedMail(
        { email, ...(toName ? { name: toName } : {}) },
        withoutUndefined({ fromName, toName, title: ticket.title, detail: ticket.subtitle, hasAccount: Boolean(recipient) }),
      ),
      status: 'queued',
      attempts: 0,
      createdAt: at,
    }
    tx.create(collections.mail().doc(), mail)
    return { ...ticket, status: 'transferred' as const, transfer }
  })

  return toTicket(sent)
})

/**
 * Hands over tickets waiting under the caller's email. Only for a confirmed
 * address: anyone can sign up with any email, so an unconfirmed one proves nothing.
 */
export const claimTickets = callable<'claimTickets'>({}, async (_data, caller) => {
  if (!caller.email || !caller.emailVerified) {
    throw new ApiError('unauthorized', 'Confirm your email address first.')
  }
  const waiting = await collections.tickets().where('claimEmail', '==', caller.email).where('userId', '==', null).get()
  if (waiting.empty) return { claimed: 0 }
  const batch = db.batch()
  for (const doc of waiting.docs) batch.update(doc.ref, { userId: caller.uid, claimEmail: FieldValue.delete() })
  await batch.commit()
  return { claimed: waiting.size }
})

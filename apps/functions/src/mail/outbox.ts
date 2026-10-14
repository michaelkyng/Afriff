import { logger } from 'firebase-functions'
import { onDocumentCreated } from 'firebase-functions/firestore'
import { FieldValue } from 'firebase-admin/firestore'
import { COLLECTIONS } from '@afriff/api/firebase/schema'
import type { MailDoc } from '@afriff/api/firebase/schema'
import { db } from '../admin'
import { appUrl, BREVO_API_KEY, MAIL_FROM_EMAIL, MAIL_FROM_NAME, MAIL_REPLY_TO, MAIL_TRANSPORT } from '../env'
import { BrevoError, sendWithBrevo } from './brevo'
import { renderMail } from './templates'

/** Retries are spread out by Cloud Functions; after this many the message is marked failed. */
const MAX_ATTEMPTS = 5

/**
 * Sends each message written to `mail/{id}`. A message is claimed in a
 * transaction first, so a retried event cannot send it twice once it has gone;
 * a temporary failure puts it back in the queue and throws, which asks Cloud
 * Functions to retry with backoff.
 */
export const sendMail = onDocumentCreated(
  { document: `${COLLECTIONS.mail}/{mailId}`, secrets: [BREVO_API_KEY], retry: true },
  async (event) => {
    const ref = event.data?.ref
    if (!ref) return

    const mail = await db.runTransaction(async (tx) => {
      const current = (await tx.get(ref)).data() as MailDoc | undefined
      if (!current || current.status !== 'queued') return null
      tx.update(ref, { status: 'sending', attempts: FieldValue.increment(1) })
      return current
    })
    if (!mail) return

    const content = renderMail(mail.template, mail.params, { appUrl: appUrl() })

    if (MAIL_TRANSPORT.value() === 'log') {
      logger.info(`Email (not sent, MAIL_TRANSPORT=log) to ${mail.to.email}: ${content.subject}`, { text: content.text })
      await ref.update({ status: 'sent', sentAt: new Date().toISOString(), messageId: 'logged' })
      return
    }

    try {
      const replyTo = MAIL_REPLY_TO.value().trim()
      const { messageId } = await sendWithBrevo(BREVO_API_KEY.value(), {
        sender: { email: MAIL_FROM_EMAIL.value(), name: MAIL_FROM_NAME.value() },
        to: [mail.to],
        ...(replyTo ? { replyTo: { email: replyTo } } : {}),
        subject: content.subject,
        htmlContent: content.html,
        textContent: content.text,
        tags: [mail.template],
      })
      await ref.update({ status: 'sent', sentAt: new Date().toISOString(), messageId, error: FieldValue.delete() })
    }
    catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const retryable = !(error instanceof BrevoError) || error.retryable
      if (retryable && mail.attempts + 1 < MAX_ATTEMPTS) {
        await ref.update({ status: 'queued', error: message })
        throw error
      }
      logger.error('Email could not be sent', { mailId: ref.id, template: mail.template, error: message })
      await ref.update({ status: 'failed', error: message })
    }
  },
)

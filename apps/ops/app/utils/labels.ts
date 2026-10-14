import type { OrderStatus, TicketStatus, UpdateKind } from '@afriff/api'
import { toLagosIso } from '@afriff/api/ops'

type Tone = 'neutral' | 'accent' | 'success' | 'danger' | 'info'

export const ORDER_STATUS: Record<OrderStatus, { label: string; tone: Tone }> = {
  paid: { label: 'Paid', tone: 'success' },
  pending: { label: 'Waiting', tone: 'accent' },
  failed: { label: 'Not paid', tone: 'danger' },
}

export const TICKET_STATUS: Record<TicketStatus, { label: string; tone: Tone }> = {
  valid: { label: 'Valid', tone: 'success' },
  used: { label: 'Used', tone: 'neutral' },
  transferred: { label: 'Passed on', tone: 'neutral' },
  void: { label: 'Void', tone: 'danger' },
}

export const UPDATE_KIND: Record<UpdateKind, string> = {
  schedule: 'Schedule change',
  venue: 'Venue notice',
  announcement: 'Announcement',
}

export const MAIL_TEMPLATE: Record<string, string> = {
  order_paid: 'Order confirmation',
  ticket_received: 'Ticket passed on',
  update_notice: 'Update about their ticket',
  staff_invite: 'Staff invitation',
}

/** A datetime-local value ("2026-11-03T21:00") read as Lagos time. */
export function fromLagosInput(value: string): string {
  return `${value}:00+01:00`
}

/** An instant as a datetime-local value in Lagos time. */
export function toLagosInput(iso: string): string {
  return toLagosIso(Date.parse(iso)).slice(0, 16)
}

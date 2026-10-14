import type { MailDoc, MailTemplate, OrderDoc } from '@afriff/api/firebase/schema'
import { formatMoney } from '@afriff/api/format'
import type { StaffRole } from '@afriff/api/door'
import type { FestivalUpdate, Money } from '@afriff/api/types'

/**
 * Festival email, written here rather than in Brevo's editor so it is versioned,
 * reviewed and tested with the code that sends it. Every value from the outside
 * world is escaped. Copy follows the app's rules: no em or en dashes, at most
 * one middle dot per line.
 *
 * Account email (password resets, address confirmation) is sent by Firebase
 * Auth itself, through Brevo's SMTP relay; see `firebase/README.md`.
 */

export interface OrderPaidParams {
  orderId: string
  reference: string
  name: string
  ticketCount: number
  /** `unitPrice` each, `amount` for the line: shown as the app's order summary shows them. */
  lines: { title: string; detail?: string; quantity: number; unitPrice: Money; amount: Money }[]
  total: Money
}

export interface TicketReceivedParams {
  fromName: string
  toName?: string
  title: string
  detail?: string
  /** Whether the ticket is already in an account, or waiting for one to be made. */
  hasAccount: boolean
}

export interface UpdateNoticeParams {
  name?: string
  title: string
  body: string
  /** A path in the app, from the update's link. */
  link?: string
}

export interface StaffInviteParams {
  name: string
  role: StaffRole
  setPasswordUrl: string
  /** Where to sign in once the password is set; empty when the address is not configured. */
  signInUrl: string
  invitedBy: string
  newAccount: boolean
}

type Draft = Pick<MailDoc, 'template' | 'to' | 'params' | 'orderId'>

export function orderPaidMail(order: Pick<OrderDoc, 'id' | 'reference' | 'contact' | 'lines' | 'total'>, ticketCount: number): Draft {
  const params: OrderPaidParams = {
    orderId: order.id,
    reference: order.reference,
    name: order.contact.name,
    ticketCount,
    lines: order.lines.map((line) => ({
      title: line.title,
      ...(line.detail ? { detail: line.detail } : {}),
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      amount: { amount: line.unitPrice.amount * line.quantity, currency: line.unitPrice.currency },
    })),
    total: order.total,
  }
  return { template: 'order_paid', to: { email: order.contact.email, name: order.contact.name }, params: { ...params }, orderId: order.id }
}

export function ticketReceivedMail(to: { email: string; name?: string }, params: TicketReceivedParams): Draft {
  return { template: 'ticket_received', to, params: { ...params } }
}

export function updateNoticeMail(to: { email: string; name?: string }, update: Pick<FestivalUpdate, 'title' | 'body' | 'link'>): Draft {
  const params: UpdateNoticeParams = { ...(to.name ? { name: to.name } : {}), title: update.title, body: update.body, ...(update.link ? { link: update.link } : {}) }
  return { template: 'update_notice', to, params: { ...params } }
}

export function staffInviteMail(to: { email: string; name?: string }, params: StaffInviteParams): Draft {
  return { template: 'staff_invite', to, params: { ...params } }
}

// ------------------------------------------------------------------ rendering

export interface RenderedMail {
  subject: string
  html: string
  text: string
}

const COLOURS = {
  page: '#f4f2ec',
  card: '#ffffff',
  navy: '#0a1042',
  gold: '#d9a441',
  onGold: '#1a1305',
  ink: '#262a40',
  muted: '#6b6f80',
  line: '#e7e4dc',
}

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Only our own app's links go into a button. */
function safeUrl(url: string): string {
  return /^https?:\/\//i.test(url) ? escapeHtml(url) : '#'
}

function firstName(name: string | undefined): string {
  return (name ?? '').trim().split(/\s+/)[0] || 'there'
}

interface Layout {
  /** The line inboxes show after the subject. */
  preheader: string
  heading: string
  /** Already-escaped HTML. */
  body: string
  cta: { label: string; url: string }
  /** Already-escaped HTML, under the button. */
  after?: string
}

function layout({ preheader, heading, body, cta, after = '' }: Layout): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escapeHtml(heading)}</title>
</head>
<body style="margin:0;padding:0;background:${COLOURS.page};font-family:${FONT};color:${COLOURS.ink};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLOURS.page};">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${COLOURS.card};border-radius:16px;overflow:hidden;border:1px solid ${COLOURS.line};">
<tr><td style="background:${COLOURS.navy};padding:20px 32px;color:${COLOURS.gold};font-size:18px;font-weight:700;letter-spacing:0.08em;">AFRIFF</td></tr>
<tr><td style="padding:32px;">
<h1 style="margin:0 0 16px;font-size:24px;line-height:1.25;color:${COLOURS.navy};">${escapeHtml(heading)}</h1>
${body}
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 8px;"><tr><td style="border-radius:999px;background:${COLOURS.gold};">
<a href="${safeUrl(cta.url)}" style="display:inline-block;padding:13px 24px;font-size:15px;font-weight:600;color:${COLOURS.onGold};text-decoration:none;">${escapeHtml(cta.label)}</a>
</td></tr></table>
${after}
</td></tr>
</table>
<p style="max-width:560px;margin:20px auto 0;font-size:12px;line-height:1.5;color:${COLOURS.muted};">Africa International Film Festival, Lagos. Questions? Reply to this email or find the festival desk at any venue.</p>
</td></tr>
</table>
</body>
</html>`
}

const paragraph = (html: string) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;">${html}</p>`

function renderOrderPaid(params: OrderPaidParams, appUrl: string): RenderedMail {
  const tickets = params.ticketCount === 1 ? '1 ticket' : `${params.ticketCount} tickets`
  const ticketsUrl = `${appUrl}/tickets?view=mine`
  const orderUrl = `${appUrl}/orders/${encodeURIComponent(params.orderId)}`

  const rows = params.lines
    .map(
      (line) => `<tr>
<td style="padding:12px 0;border-top:1px solid ${COLOURS.line};font-size:14px;line-height:1.45;">
<strong>${escapeHtml(line.title)}</strong><br><span style="color:${COLOURS.muted};">${line.detail ? `${escapeHtml(line.detail)}, ` : ''}${line.quantity} × ${escapeHtml(formatMoney(line.unitPrice))}</span>
</td>
<td align="right" style="padding:12px 0 12px 16px;border-top:1px solid ${COLOURS.line};font-size:14px;white-space:nowrap;">${escapeHtml(formatMoney(line.amount))}</td>
</tr>`,
    )
    .join('')

  const body = [
    paragraph(`Hi ${escapeHtml(firstName(params.name))}, your payment for order <strong>${escapeHtml(params.reference)}</strong> went through. Your ${tickets} ${params.ticketCount === 1 ? 'is' : 'are'} waiting in the app under My tickets: show the QR code at the door.`),
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;">${rows}
<tr><td style="padding:12px 0;border-top:1px solid ${COLOURS.line};font-size:15px;font-weight:700;">Total</td>
<td align="right" style="padding:12px 0;border-top:1px solid ${COLOURS.line};font-size:15px;font-weight:700;">${escapeHtml(formatMoney(params.total))}</td></tr>
</table>`,
  ].join('\n')

  const after = paragraph(`<a href="${safeUrl(orderUrl)}" style="color:${COLOURS.navy};">See the order</a> any time. Your tickets open without a connection once you have opened them in the app.`)

  const text = [
    `Hi ${firstName(params.name)},`,
    '',
    `Your payment for order ${params.reference} went through. Your ${tickets} ${params.ticketCount === 1 ? 'is' : 'are'} waiting in the app under My tickets: show the QR code at the door.`,
    '',
    ...params.lines.map((line) => `${line.title}${line.detail ? ` (${line.detail})` : ''}: ${line.quantity} × ${formatMoney(line.unitPrice)} = ${formatMoney(line.amount)}`),
    `Total: ${formatMoney(params.total)}`,
    '',
    `Open my tickets: ${ticketsUrl}`,
    `See the order: ${orderUrl}`,
  ].join('\n')

  return {
    subject: `Your AFRIFF tickets are ready (${params.reference})`,
    html: layout({
      preheader: `${tickets} for ${params.lines[0]?.title ?? 'AFRIFF'}, ready in the app.`,
      heading: 'Your tickets are ready',
      body,
      cta: { label: 'Open my tickets', url: ticketsUrl },
      after,
    }),
    text,
  }
}

function renderTicketReceived(params: TicketReceivedParams, appUrl: string): RenderedMail {
  const what = `${params.title}${params.detail ? ` (${params.detail})` : ''}`
  const next = params.hasAccount
    ? 'It is already in the app under My tickets.'
    : 'Create your AFRIFF account with this email address and confirm it, and the ticket will be waiting under My tickets.'
  const cta = params.hasAccount
    ? { label: 'Open my tickets', url: `${appUrl}/tickets?view=mine` }
    : { label: 'Create my account', url: `${appUrl}/signup` }

  return {
    subject: `${params.fromName} sent you a ticket to ${params.title}`,
    html: layout({
      preheader: `A ticket to ${params.title} from ${params.fromName}.`,
      heading: 'You have a ticket',
      body: paragraph(`Hi ${escapeHtml(firstName(params.toName))}, ${escapeHtml(params.fromName)} has passed you a ticket to <strong>${escapeHtml(what)}</strong>. ${escapeHtml(next)}`),
      cta,
    }),
    text: [`Hi ${firstName(params.toName)},`, '', `${params.fromName} has passed you a ticket to ${what}. ${next}`, '', `${cta.label}: ${cta.url}`].join('\n'),
  }
}

function renderUpdateNotice(params: UpdateNoticeParams, appUrl: string): RenderedMail {
  const url = `${appUrl}${params.link ?? '/updates'}`
  return {
    subject: params.title,
    html: layout({
      preheader: params.body.slice(0, 120),
      heading: params.title,
      body: [
        paragraph(`Hi ${escapeHtml(firstName(params.name))}, this is about a ticket you hold.`),
        paragraph(escapeHtml(params.body)),
      ].join('\n'),
      cta: { label: 'Open AFRIFF', url },
    }),
    text: [`Hi ${firstName(params.name)}, this is about a ticket you hold.`, '', params.body, '', `Open AFRIFF: ${url}`].join('\n'),
  }
}

const ROLE_WORDS: Record<StaffRole, string> = {
  door: 'checking tickets at the door, with AFRIFF Door',
  ops: 'running the festival in the Ops Console',
  admin: 'running the festival in the Ops Console, as an admin',
}

function renderStaffInvite(params: StaffInviteParams): RenderedMail {
  const where = params.signInUrl
    ? `Then sign in at ${params.signInUrl} with this email address.`
    : 'Then ask the festival team for the address to sign in at.'
  const opening = params.newAccount
    ? `${params.invitedBy} has set you up for ${ROLE_WORDS[params.role]}. Choose a password to get started.`
    : `${params.invitedBy} has given your AFRIFF account access for ${ROLE_WORDS[params.role]}. If you already know your password, you can sign in straight away.`
  return {
    subject: 'You are on the AFRIFF team',
    html: layout({
      preheader: `Access for ${ROLE_WORDS[params.role]}.`,
      heading: 'You are on the team',
      body: [paragraph(`Hi ${escapeHtml(firstName(params.name))}, ${escapeHtml(opening)}`), paragraph(escapeHtml(where))].join('\n'),
      cta: { label: params.newAccount ? 'Choose a password' : 'Set a new password', url: params.setPasswordUrl },
      after: paragraph(`<span style="color:${COLOURS.muted};">The link works once and expires. If it has, ask the person who invited you to send another.</span>`),
    }),
    text: [`Hi ${firstName(params.name)},`, '', opening, where, '', `Set your password: ${params.setPasswordUrl}`].join('\n'),
  }
}

export function renderMail(template: MailTemplate, params: Record<string, unknown>, context: { appUrl: string }): RenderedMail {
  switch (template) {
    case 'update_notice':
      return renderUpdateNotice(params as unknown as UpdateNoticeParams, context.appUrl)
    case 'staff_invite':
      return renderStaffInvite(params as unknown as StaffInviteParams)
    case 'order_paid':
      return renderOrderPaid(params as unknown as OrderPaidParams, context.appUrl)
    case 'ticket_received':
      return renderTicketReceived(params as unknown as TicketReceivedParams, context.appUrl)
  }
}

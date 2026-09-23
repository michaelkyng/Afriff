import type { ISODateTime, Ticket, TicketStatus } from './types'

/**
 * What a ticket is, away from the API: what its code says, whether it still
 * admits anyone, and how it goes into a calendar. All of it works from the
 * ticket alone, so the detail screen holds up with no network.
 */

/** The version tag in the payload, so the scanner can tell old codes from new. */
const PAYLOAD_VERSION = 'AF1'

/**
 * What the QR code carries.
 *
 * Shaped like the signed token the backend will issue: a version, the ticket,
 * its printed code, and what it admits to. Nothing here is secret and nothing
 * here proves anything on its own — the scanner checks it against the festival's
 * own records, exactly as it will when the payload is signed.
 */
export function ticketPayload(ticket: Ticket): string {
  return [PAYLOAD_VERSION, ticket.id, ticket.code, ticket.startsAt ?? 'open'].join('|')
}

/**
 * What the ticket is, right now.
 *
 * `expired` is not stored: a ticket that was never used simply stops admitting
 * anyone once its screening is over, and passes never expire.
 */
export function ticketState(ticket: Ticket, now: Date = new Date()): TicketStatus | 'expired' {
  if (ticket.status !== 'valid') return ticket.status
  const ends = ticket.endsAt ?? ticket.startsAt
  if (ends && Date.parse(ends) < now.getTime()) return 'expired'
  return 'valid'
}

/** True while the ticket would still get someone through the door. */
export function ticketAdmits(ticket: Ticket, now: Date = new Date()): boolean {
  return ticketState(ticket, now) === 'valid'
}

/** Escapes the characters iCalendar gives meaning to. */
function icsEscape(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/[;,]/g, (match) => `\\${match}`).replace(/\r?\n/g, '\\n')
}

function icsStamp(value: ISODateTime | Date): string {
  const date = value instanceof Date ? value : new Date(value)
  return `${date.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`
}

/** Long lines have to be folded at 75 octets, with a space starting the next one. */
function icsFold(line: string): string {
  if (line.length <= 75) return line
  const parts = [line.slice(0, 75)]
  for (let i = 75; i < line.length; i += 74) parts.push(` ${line.slice(i, i + 74)}`)
  return parts.join('\r\n')
}

/**
 * The ticket as a calendar file, or null for a pass that is not tied to a time.
 *
 * Two hours is the assumption when a ticket carries no end time, which is long
 * enough for a feature and its Q&A.
 */
export function ticketIcs(ticket: Ticket, now: Date = new Date()): string | null {
  if (!ticket.startsAt) return null
  const start = new Date(ticket.startsAt)
  const end = ticket.endsAt ? new Date(ticket.endsAt) : new Date(start.getTime() + 2 * 60 * 60 * 1000)

  const description = [`${ticket.productName}.`, `Entry code ${ticket.code}.`, `In the name of ${ticket.holderName}.`]
    .join(' ')

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//AFRIFF//Attendee//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${ticket.id}@afriff.com`,
    `DTSTAMP:${icsStamp(now)}`,
    `DTSTART:${icsStamp(start)}`,
    `DTEND:${icsStamp(end)}`,
    `SUMMARY:${icsEscape(ticket.title)}`,
    ticket.venueName ? `LOCATION:${icsEscape(ticket.venueName)}` : null,
    `DESCRIPTION:${icsEscape(description)}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT60M',
    'ACTION:DISPLAY',
    `DESCRIPTION:${icsEscape(ticket.title)} starts in an hour`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter((line): line is string => line !== null)

  return `${lines.map(icsFold).join('\r\n')}\r\n`
}

/** A filename an attendee will recognise in their downloads. */
export function ticketIcsFilename(ticket: Ticket): string {
  const slug = ticket.title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return `afriff-${slug || 'ticket'}.ics`
}

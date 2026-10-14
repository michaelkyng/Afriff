import { checkInSchema, signInSchema } from '@afriff/validation'
import { ApiError, validationError } from '../contract'
import {
  decideCheckIn,
  doorSessions,
  isPass,
  marksUsed,
  NO_COUNT,
  parseScan,
  scannedTicket,
  sessionKey,
} from '../door'
import type { CheckInInput, CheckInResult, DoorApi, DoorCount, DoorSession, SessionRef, StaffMember } from '../door'
import { lagosDateKey } from '../format'
import { ticketPayload } from '../tickets'
import type { ProductKind, Ticket, TicketSelection } from '../types'
import { mockDb } from './db'
import * as seed from './seed'

/**
 * The door on the mock: the same rules as the `checkIn` function, with a demo
 * door account and demo tickets. The scanner runs on its own origin, so it
 * cannot see tickets bought in the attendee app's mock; instead each session
 * comes with a set of tickets covering every outcome, for the demo panel to scan.
 */

/** The demo door account, shown on the scanner's sign-in screen in mock mode. */
export const MOCK_STAFF = { email: 'door@afriff.test', password: 'door-demo-1' } as const

const STAFF: StaffMember = { id: 'stf_door_demo', email: MOCK_STAFF.email, name: 'Door team (demo)', role: 'door' }

/** One of the demo tickets: what it is, and what scanning it sends. */
export interface DemoTicket {
  label: string
  holderName: string
  scan: string
}

export interface MockDoorApi extends DoorApi {
  /** Tickets to try at a session: one of each kind a door meets, including the wrong ones. */
  demoTickets(session: SessionRef): DemoTicket[]
}

const HOLDERS = ['Chidinma Eze', 'Kofi Mensah', 'Amara Obi', 'Tunde Bakare', 'Zainab Bello', 'Nneka Okafor', 'Femi Adeyemi']

/** FNV-1a: a stable number from a string, so a session's demo tickets are the same on every load. */
function hash(text: string): number {
  let value = 0x811c9dc5
  for (const char of text) value = Math.imul(value ^ char.charCodeAt(0), 0x01000193) >>> 0
  return value
}

const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'

function demoCode(seedText: string): string {
  let value = hash(seedText)
  let code = ''
  for (let index = 0; index < 8; index += 1) {
    code += ALPHABET[value % ALPHABET.length]
    value = (Math.floor(value / ALPHABET.length) ^ hash(`${seedText}${index}`)) >>> 0
  }
  return `AF-${code.slice(0, 4)}-${code.slice(4)}`
}

export function createMockDoorApi(options: { latency: number }): MockDoorApi {
  const respond = async <T>(produce: () => T): Promise<T> => {
    if (options.latency > 0) await new Promise((resolve) => setTimeout(resolve, options.latency * (0.6 + Math.random() * 0.8)))
    return structuredClone(produce())
  }

  const sessions = doorSessions(seed)
  const findSession = (ref: SessionRef) => sessions.find((item) => item.ref.kind === ref.kind && item.ref.id === ref.id)
  const eventOf = (id: string) => seed.events.find((event) => event.id === id)

  let signedIn = mockDb.read<boolean>('door:staff', false)
  const checkIns = mockDb.read<Record<string, { at: string; byName: string }>>('door:checkins', {})
  const counts = mockDb.read<Record<string, DoorCount>>('door:counts', {})
  const used = mockDb.read<Record<string, string>>('door:used', {})
  const listeners = new Map<string, Set<(count: DoorCount) => void>>()
  const tickets = new Map<string, { ticket: Ticket; label: string }[]>()

  const persist = () => {
    mockDb.write('door:staff', signedIn)
    mockDb.write('door:checkins', checkIns)
    mockDb.write('door:counts', counts)
    mockDb.write('door:used', used)
  }

  function requireStaff() {
    if (!signedIn) throw new ApiError('unauthorized', 'Sign in to continue.')
  }

  /** The demo tickets for a session, made once and kept, so a second scan finds the first. */
  function ticketsFor(session: DoorSession) {
    const key = sessionKey(session.ref)
    const existing = tickets.get(key)
    if (existing) return existing

    const day = lagosDateKey(session.startsAt)
    const otherDay = seed.festival.days.find((item) => item.date !== day)?.date ?? day
    const otherScreening = seed.screenings.find((item) => item.id !== session.ref.id && item.format === 'Standard')!
    const gala = session.format === 'Gala'
      ? seed.events.find((event) => (event.kind === 'gala' || event.kind === 'awards') && event.venueId === session.venueId)
      : undefined
    const ownEvent = session.ref.kind === 'event' ? seed.events.find((event) => event.id === session.ref.id) : undefined

    const filmTitle = (screeningId: string) => {
      const screening = seed.screenings.find((item) => item.id === screeningId)
      return seed.films.find((film) => film.id === screening?.filmId)?.title ?? 'Screening'
    }

    const make = (
      index: number,
      label: string,
      kind: ProductKind,
      productName: string,
      title: string,
      selection?: TicketSelection,
      status: Ticket['status'] = 'valid',
    ): { ticket: Ticket; label: string } => ({
      label,
      ticket: {
        id: `tkt_demo_${hash(`${key}:${index}`).toString(36)}`,
        code: demoCode(`${key}:${index}`),
        orderId: 'ord_demo',
        productId: `prod_${kind}`,
        productName,
        kind,
        status,
        holderName: HOLDERS[(hash(key) + index) % HOLDERS.length]!,
        title,
        issuedAt: '2026-10-01T09:00:00+01:00',
        ...(selection ? { selection } : {}),
      },
    })

    // The session's own ticket, where it sells one. Panels and the Mixer are for pass holders.
    const ownTicket = gala
      ? make(0, `${gala.title} ticket`, 'gala', gala.title, gala.title, { eventId: gala.id })
      : ownEvent
        ? ownEvent.productId
          ? make(0, `Ticket for ${ownEvent.title}`, ownEvent.kind === 'masterclass' ? 'masterclass' : 'gala', ownEvent.title, ownEvent.title, { eventId: ownEvent.id })
          : null
        : make(0, 'Single ticket for this screening', 'screening', 'Single Screening', session.title, { screeningId: session.ref.id })
    const festivalPass = make(1, 'Festival Pass', 'festival_pass', 'Festival Pass', 'Festival Pass')
    const first = ownTicket ?? festivalPass
    const { kind, productName, title, selection } = first.ticket

    const set = [
      ...(ownTicket ? [ownTicket] : []),
      festivalPass,
      make(2, 'Day Pass for this day', 'day_pass', 'Day Pass', 'Day Pass', { day }),
      make(3, 'Day Pass for another day', 'day_pass', 'Day Pass', 'Day Pass', { day: otherDay }),
      make(4, 'Single ticket for another screening', 'screening', 'Single Screening', filmTitle(otherScreening.id), { screeningId: otherScreening.id }),
      make(5, 'Passed on to someone else', kind, productName, title, selection, 'transferred'),
      make(6, 'Cancelled (void)', kind, productName, title, selection, 'void'),
    ]
    tickets.set(key, set)
    return set
  }

  function findTicket(scan: { ticketId?: string; code: string }): Ticket | null {
    for (const set of tickets.values()) {
      const found = set.find(({ ticket }) => (scan.ticketId ? ticket.id === scan.ticketId : true) && ticket.code === scan.code)
      if (found) return { ...found.ticket, ...(used[found.ticket.id] ? { status: 'used' as const, usedAt: used[found.ticket.id] } : {}) }
    }
    return null
  }

  return {
    auth: {
      restore: () => respond(() => (signedIn ? STAFF : null)),

      signIn: (input) =>
        respond(() => {
          const parsed = signInSchema.safeParse(input)
          if (!parsed.success) throw validationError(parsed.error.issues, 'Check your email and password.')
          if (parsed.data.email !== MOCK_STAFF.email || parsed.data.password !== MOCK_STAFF.password) {
            throw new ApiError('unauthorized', 'That email and password do not match a door account.', { field: 'password' })
          }
          signedIn = true
          persist()
          return STAFF
        }),

      signOut: () =>
        respond(() => {
          signedIn = false
          persist()
        }),
    },

    sessions: () => respond(() => sessions),

    checkIn: (input: CheckInInput) =>
      respond((): CheckInResult => {
        requireStaff()
        const parsed = checkInSchema.safeParse(input)
        if (!parsed.success) throw validationError(parsed.error.issues, 'Scan a ticket or type its code.')
        const session = findSession(parsed.data.session)
        if (!session) throw new ApiError('not_found', 'That screening or event is not in the programme.')
        ticketsFor(session)

        const now = parsed.data.at ? new Date(parsed.data.at) : new Date()
        const at = now.toISOString()
        const key = sessionKey(session.ref)
        const scan = parseScan(parsed.data.scan)
        const ticket = scan ? findTicket(scan) : null
        const previous = ticket ? checkIns[`${key}_${ticket.id}`] ?? null : null
        const count = counts[key] ?? NO_COUNT

        const outcome = decideCheckIn({ ticket, session, eventOf, previous, count, now })
        const result: CheckInResult = {
          outcome,
          at,
          ...(ticket ? { ticket: scannedTicket(ticket) } : {}),
          ...(previous ? { previous } : ticket?.usedAt && outcome === 'already_in' ? { previous: { at: ticket.usedAt } } : {}),
          count,
        }
        if (outcome !== 'admitted' || !ticket) return result

        checkIns[`${key}_${ticket.id}`] = { at, byName: STAFF.name }
        if (marksUsed(ticket)) used[ticket.id] = at
        const next = { admitted: count.admitted + 1, passAdmitted: count.passAdmitted + (isPass(ticket) ? 1 : 0) }
        counts[key] = next
        persist()
        listeners.get(key)?.forEach((listener) => listener({ ...next }))
        return { ...result, count: next }
      }),

    watchCount(ref, listener) {
      const key = sessionKey(ref)
      const set = listeners.get(key) ?? new Set()
      set.add(listener)
      listeners.set(key, set)
      listener({ ...(counts[key] ?? NO_COUNT) })
      return () => set.delete(listener)
    },

    demoTickets(ref) {
      const session = findSession(ref)
      if (!session) return []
      return [
        ...ticketsFor(session).map(({ ticket, label }) => ({ label, holderName: ticket.holderName, scan: ticketPayload(ticket) })),
        { label: 'A code that is not ours', holderName: '', scan: 'AF-ZZZZ-ZZZZ' },
      ]
    },
  }
}

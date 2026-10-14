import {
  cancelScreeningSchema,
  deleteUpdateSchema,
  inviteStaffSchema,
  markRefundedSchema,
  moveScreeningSchema,
  publishUpdateSchema,
  reissueTicketSchema,
  resendOrderEmailSchema,
  setStaffRoleSchema,
  signInSchema,
  updateProductSchema,
  voidTicketSchema,
} from '@afriff/validation'
import type { ZodType } from 'zod'
import { ApiError, validationError } from '../contract'
import { NO_COUNT, sessionKey } from '../door'
import type { DoorCount, StaffMember } from '../door'
import { formatDay, formatMoney, formatTime } from '../format'
import { canDo, count, draftForCancel, draftForMove, movedScreening, parseOpsQuery, ticketPatch } from '../ops'
import type { AuditEntry, AuditTarget, OpsActionName, OpsActions, OpsApi, OpsMail, OpsOrder, OpsTicket, StaffAccount } from '../ops'
import { catalogFrom, newId, orderTotal, randomCode, resolveLine, ticketsFor, withoutUndefined } from '../orders'
import type { FestivalUpdate, Screening, TicketProduct } from '../types'
import { mockDb } from './db'
import * as seed from './seed'

/**
 * The Ops Console on the mock. It runs on its own origin, so it cannot see the
 * attendee app's mock orders; it makes its own set instead (paid, waiting,
 * failed, and a few needing a refund) and applies every change with the same
 * shared rules the `ops` function uses.
 */

/** The demo console account: an admin, so every page can be tried. */
export const MOCK_OPS = { email: 'ops@afriff.test', password: 'ops-demo-1' } as const

const ME: StaffMember = { id: 'stf_ops_demo', email: MOCK_OPS.email, name: 'Ops team (demo)', role: 'admin' }

const NAMES = [
  'Ada Okoye', 'Kofi Mensah', 'Amara Obi', 'Tunde Bakare', 'Zainab Bello', 'Nneka Okafor', 'Femi Adeyemi', 'Chidinma Eze',
  'Emeka Nwosu', 'Halima Musa', 'Ifeoma Chukwu', 'Seun Ogunleye', 'Bisi Alade', 'Yusuf Danjuma', 'Efe Omoregie', 'Kemi Bankole',
]

/** A small seeded generator, so the demo orders are the same set every time they are made. */
function prng(seedValue: number) {
  let state = seedValue >>> 0
  return () => {
    state += 0x6d2b79f5
    let value = Math.imul(state ^ (state >>> 15), 1 | state)
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

interface State {
  screenings: Screening[]
  products: TicketProduct[]
  updates: FestivalUpdate[]
  orders: OpsOrder[]
  tickets: OpsTicket[]
  mail: (OpsMail & { orderId?: string })[]
  audit: AuditEntry[]
  staff: StaffAccount[]
  counts: Record<string, DoorCount>
}

function demoOrders(products: TicketProduct[], screenings: Screening[]): { orders: OpsOrder[]; tickets: OpsTicket[] } {
  const random = prng(2026)
  const pick = <T>(items: readonly T[]) => items[Math.floor(random() * items.length)]!
  const catalog = catalogFrom({ ...seed, products, screenings })
  // A handful of popular screenings, so moving one in the demo has tickets to bring along.
  const popular = screenings.filter((item) => item.format === 'Standard').slice(0, 6)
  const orders: OpsOrder[] = []
  const tickets: OpsTicket[] = []

  for (let index = 0; index < 36; index += 1) {
    const name = pick(NAMES)
    const email = `${name.toLowerCase().replace(/[^a-z]+/g, '.')}${index % 3 === 0 ? '' : index}@example.com`
    const roll = random()
    const item = roll < 0.45
      ? { productId: 'prod_screening', quantity: 1 + Math.floor(random() * 3), selection: { screeningId: pick(popular).id } }
      : roll < 0.65
        ? { productId: 'prod_festival_pass', quantity: 1 }
        : roll < 0.8
          ? { productId: 'prod_day_pass', quantity: 1 + Math.floor(random() * 2), selection: { day: pick(seed.festival.days).date } }
          : roll < 0.9
            ? { productId: 'prod_masterclass', quantity: 1, selection: { eventId: 'evt_mc_writing' } }
            : { productId: 'prod_opening', quantity: 2 }
    const lines = [resolveLine(item, catalog)]
    // Spread over the selling weeks before the festival, the way sales come in.
    const placedAt = new Date(Date.parse('2026-09-01T09:00:00+01:00') + index * 26 * 3_600_000 + Math.floor(random() * 3_600_000))
    const status = index % 12 === 5 ? 'pending' : index % 12 === 9 ? 'failed' : 'paid'
    const reference = `AF-${randomCode(5)}`
    const order: OpsOrder = {
      id: newId.order(),
      reference,
      userId: `usr_demo_${index}`,
      status,
      placedAt: placedAt.toISOString(),
      lines,
      total: orderTotal(lines),
      contact: { name, email },
      payment: status === 'paid'
        ? { provider: 'paystack', reference: `${reference}-1`, channel: pick(['card', 'card', 'bank_transfer', 'ussd'] as const), last4: '4081', cardBrand: 'visa' }
        : status === 'failed'
          ? { provider: 'paystack', reference: `${reference}-1`, failureReason: 'Your bank declined this payment. Try another card or method.' }
          : { provider: 'paystack', reference: `${reference}-1` },
      ticketIds: [],
      ...(status === 'pending' ? { holdExpiresAt: new Date(placedAt.getTime() + 30 * 60_000).toISOString() } : {}),
      ...(status === 'paid' ? { paidAt: new Date(placedAt.getTime() + 90_000).toISOString() } : {}),
    }
    if (status === 'paid') {
      const issued = ticketsFor(order, catalog, order.paidAt).map((ticket) => ({ ...ticket, userId: order.userId }))
      order.ticketIds = issued.map((ticket) => ticket.id)
      tickets.push(...issued)
    }
    // Two that need the team: paid after the hold lapsed, and paid twice.
    if (index === 7) Object.assign(order, { status: 'failed', ticketIds: [], refundDue: true, refundReason: 'Paid after the tickets were released', payment: { ...order.payment, failureReason: 'Your payment arrived after your tickets were released, and they have sold out since. We will refund you in full.' } })
    if (index === 15) Object.assign(order, { refundDue: true, refundReason: 'Paid twice', duplicatePayments: [`${reference}-2`] })
    orders.push(order)
  }
  return { orders: orders.reverse(), tickets }
}

function initialState(): State {
  const screenings = structuredClone(seed.screenings)
  const products = structuredClone(seed.products)
  const { orders, tickets } = demoOrders(products, screenings)
  return {
    screenings,
    products,
    updates: structuredClone(seed.updates),
    orders,
    tickets,
    mail: orders
      .filter((order) => order.status === 'paid')
      .map((order) => ({ id: `mail_${order.id}`, orderId: order.id, template: 'order_paid', to: order.contact.email, status: 'sent' as const, createdAt: order.paidAt!, sentAt: order.paidAt! })),
    audit: [],
    staff: [
      { ...ME, active: true },
      { id: 'stf_door_1', email: 'door1@afriff.test', name: 'Landmark door', role: 'door', active: true },
      { id: 'stf_door_2', email: 'door2@afriff.test', name: 'Twin Waters door', role: 'door', active: true },
      { id: 'stf_ops_2', email: 'desk@afriff.test', name: 'Festival desk', role: 'ops', active: true },
    ],
    counts: {},
  }
}

export function createMockOpsApi(options: { latency: number }): OpsApi {
  const respond = async <T>(produce: () => T | Promise<T>): Promise<T> => {
    if (options.latency > 0) await new Promise((resolve) => setTimeout(resolve, options.latency * (0.6 + Math.random() * 0.8)))
    return structuredClone(await produce())
  }

  let signedIn = mockDb.read<boolean>('ops:signedIn', false)
  const state: State = mockDb.read<State | null>('ops:state', null) ?? initialState()
  const persist = () => {
    mockDb.write('ops:signedIn', signedIn)
    mockDb.write('ops:state', state)
  }

  const parse = <T>(schema: ZodType<T>, input: unknown): T => {
    const parsed = schema.safeParse(input)
    if (!parsed.success) throw validationError(parsed.error.issues, 'Check the details and try again.')
    return parsed.data
  }

  const film = (id: string) => seed.films.find((item) => item.id === id)
  const venue = (id: string) => seed.venues.find((item) => item.id === id)
  const findOrder = (id: string) => {
    const order = state.orders.find((item) => item.id === id)
    if (!order) throw new ApiError('not_found', 'We could not find that order.', { id })
    return order
  }
  const findTicket = (id: string) => {
    const ticket = state.tickets.find((item) => item.id === id)
    if (!ticket) throw new ApiError('not_found', 'We could not find that ticket.', { id })
    return ticket
  }

  function log(action: OpsActionName, summary: string, target?: AuditTarget) {
    state.audit.unshift({ id: `aud_${randomCode(10).toLowerCase()}`, at: new Date().toISOString(), byUid: ME.id, byName: ME.name, action, summary, ...(target ? { target } : {}) })
  }

  function queueMail(template: string, to: string, orderId?: string) {
    // No email leaves the mock: it is recorded as sent, the way MAIL_TRANSPORT=log does.
    const at = new Date().toISOString()
    state.mail.unshift({ id: `mail_${randomCode(10).toLowerCase()}`, template, to, status: 'sent', createdAt: at, sentAt: at, ...(orderId ? { orderId } : {}) })
  }

  const actions: { [A in OpsActionName]: (input: unknown) => OpsActions[A]['output'] } = {
    moveScreening(raw) {
      const input = parse(moveScreeningSchema, raw)
      const screening = state.screenings.find((item) => item.id === input.screeningId)
      if (!screening) throw new ApiError('not_found', 'That screening is not in the programme.')
      const before = { ...screening }
      const after = movedScreening(before, input, seed.venues)
      Object.assign(screening, after)
      const affected = state.tickets.filter((ticket) => ticket.selection?.screeningId === after.id)
      const patch = withoutUndefined(ticketPatch(after, venue(after.venueId)))
      for (const ticket of affected) Object.assign(ticket, patch)
      log('moveScreening', `Moved ${film(after.filmId)?.title} (${formatDay(before.startsAt)}) from ${formatTime(before.startsAt)} to ${formatDay(after.startsAt)} ${formatTime(after.startsAt)}`, { kind: 'screening', id: after.id })
      return { before, after, ticketsAffected: affected.length, ordersFlagged: 0, draft: draftForMove(before, after, film(after.filmId), seed.venues) }
    },
    cancelScreening(raw) {
      const input = parse(cancelScreeningSchema, raw)
      const screening = state.screenings.find((item) => item.id === input.screeningId)
      if (!screening) throw new ApiError('not_found', 'That screening is not in the programme.')
      if (screening.cancelled) throw new ApiError('conflict', 'That screening is already cancelled.')
      const before = { ...screening }
      screening.cancelled = true
      const affected = state.tickets.filter((ticket) => ticket.selection?.screeningId === screening.id && ticket.status === 'valid')
      for (const ticket of affected) Object.assign(ticket, { status: 'void', voidReason: 'The screening was cancelled. We will refund you in full.' })
      const orders = state.orders.filter((order) => order.status === 'paid' && affected.some((ticket) => ticket.orderId === order.id))
      for (const order of orders) Object.assign(order, { refundDue: true, refundReason: 'Screening cancelled' })
      log('cancelScreening', `Cancelled ${film(screening.filmId)?.title} (${formatDay(screening.startsAt)} ${formatTime(screening.startsAt)}): ${count(affected.length, 'ticket')} voided, ${count(orders.length, 'order')} to refund`, { kind: 'screening', id: screening.id })
      return { before, after: { ...screening }, ticketsAffected: affected.length, ordersFlagged: orders.length, draft: draftForCancel(screening, film(screening.filmId), venue(screening.venueId)) }
    },
    publishUpdate(raw) {
      const input = parse(publishUpdateSchema, raw)
      const id = input.id ?? `upd_${randomCode(10).toLowerCase()}`
      const subject = input.subject && Object.values(input.subject).some(Boolean) ? withoutUndefined(input.subject) : undefined
      const update: FestivalUpdate = withoutUndefined({
        id, kind: input.kind, severity: input.severity, title: input.title, body: input.body,
        publishedAt: input.publishAt ?? new Date().toISOString(), subject, link: input.link,
      })
      const existing = state.updates.findIndex((item) => item.id === id)
      if (input.id && existing < 0) throw new ApiError('not_found', 'That update no longer exists.')
      if (existing >= 0) state.updates[existing] = update
      else state.updates.push(update)
      let emailed = 0
      if (input.emailTicketHolders && (subject?.screeningId || subject?.eventId)) {
        // For a cancelled screening the tickets are already void, and their holders are the ones to tell.
        const cancelled = Boolean(subject.screeningId && state.screenings.find((item) => item.id === subject.screeningId)?.cancelled)
        const holders = state.tickets.filter((ticket) =>
          (ticket.status === 'valid' || (cancelled && ticket.status === 'void'))
          && (ticket.selection?.screeningId === subject.screeningId || (subject.eventId && ticket.selection?.eventId === subject.eventId)))
        const emails = new Set(holders.map((ticket) => state.orders.find((order) => order.id === ticket.orderId)?.contact.email).filter(Boolean) as string[])
        for (const email of emails) queueMail('update_notice', email)
        emailed = emails.size
      }
      log('publishUpdate', `${input.id ? 'Edited' : 'Published'} "${update.title}"${emailed ? `, emailed to ${emailed === 1 ? '1 person' : `${emailed} people`}` : ''}`, { kind: 'update', id })
      return { update, emailed }
    },
    deleteUpdate(raw) {
      const { id } = parse(deleteUpdateSchema, raw)
      const index = state.updates.findIndex((item) => item.id === id)
      if (index < 0) throw new ApiError('not_found', 'That update no longer exists.')
      const [removed] = state.updates.splice(index, 1)
      log('deleteUpdate', `Deleted "${removed!.title}"`, { kind: 'update', id })
      return { id }
    },
    updateProduct(raw) {
      const input = parse(updateProductSchema, raw)
      const product = state.products.find((item) => item.id === input.productId)
      if (!product) throw new ApiError('not_found', 'We could not find that product.')
      const before = formatMoney(product.price)
      Object.assign(product, { price: { amount: input.priceNaira * 100, currency: 'NGN' }, remaining: input.remaining, maxPerOrder: input.maxPerOrder })
      log('updateProduct', `${product.name}: price ${before} to ${formatMoney(product.price)}, stock ${input.remaining ?? 'unlimited'}, limit ${input.maxPerOrder}`, { kind: 'product', id: product.id })
      return product
    },
    resendOrderEmail(raw) {
      const order = findOrder(parse(resendOrderEmailSchema, raw).orderId)
      if (order.status !== 'paid') throw new ApiError('conflict', 'Only a paid order has a confirmation to send.')
      queueMail('order_paid', order.contact.email, order.id)
      log('resendOrderEmail', `Resent the confirmation for ${order.reference} to ${order.contact.email}`, { kind: 'order', id: order.id })
      return { queued: true }
    },
    voidTicket(raw) {
      const input = parse(voidTicketSchema, raw)
      const ticket = findTicket(input.ticketId)
      if (ticket.status !== 'valid') throw new ApiError('conflict', 'Only a valid ticket can be voided.')
      Object.assign(ticket, { status: 'void', voidReason: input.reason })
      if (input.refund) Object.assign(findOrder(ticket.orderId), { refundDue: true, refundReason: `Ticket ${ticket.code} voided: ${input.reason}` })
      log('voidTicket', `Voided ${ticket.code} (${ticket.holderName})${input.refund ? ' and flagged a refund' : ''}: ${input.reason}`, { kind: 'ticket', id: ticket.id })
      return ticket
    },
    reissueTicket(raw) {
      const old = findTicket(parse(reissueTicketSchema, raw).ticketId)
      if (old.status !== 'valid') throw new ApiError('conflict', 'Only a valid ticket can be reissued.')
      const { voidReason: _voidReason, usedAt: _usedAt, ...rest } = old
      const fresh: OpsTicket = { ...rest, id: newId.ticket(), code: newId.ticketCode(), status: 'valid', issuedAt: new Date().toISOString() }
      Object.assign(old, { status: 'void', voidReason: `Replaced by a new ticket, ${fresh.code}. Use that one.` })
      state.tickets.push(fresh)
      const order = state.orders.find((item) => item.id === old.orderId)
      if (order) order.ticketIds = order.ticketIds.map((id) => (id === old.id ? fresh.id : id))
      log('reissueTicket', `Reissued ${old.code} as ${fresh.code} (${old.holderName})`, { kind: 'ticket', id: fresh.id })
      return fresh
    },
    markRefunded(raw) {
      const input = parse(markRefundedSchema, raw)
      const order = findOrder(input.orderId)
      if (!order.refundDue) throw new ApiError('conflict', 'That order has no refund waiting.')
      Object.assign(order, { refundDue: false, refundedAt: new Date().toISOString(), refundNote: input.note })
      log('markRefunded', `Marked ${order.reference} refunded: ${input.note}`, { kind: 'order', id: order.id })
      return order
    },
    listStaff: () => [...state.staff].sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name)),
    inviteStaff(raw) {
      const input = parse(inviteStaffSchema, raw)
      const existing = state.staff.find((item) => item.email === input.email)
      const staff: StaffAccount = { id: existing?.id ?? `stf_${randomCode(8).toLowerCase()}`, email: input.email, name: input.name, role: input.role, active: true, updatedAt: new Date().toISOString() }
      if (existing) Object.assign(existing, staff)
      else state.staff.push(staff)
      queueMail('staff_invite', input.email)
      log('inviteStaff', `Invited ${input.name} (${input.email}) as ${input.role}`, { kind: 'staff', id: staff.id })
      return { staff, inviteSent: true }
    },
    setStaffRole(raw) {
      const input = parse(setStaffRoleSchema, raw)
      if (input.uid === ME.id) throw new ApiError('conflict', 'You cannot change your own role. Ask another admin.')
      const staff = state.staff.find((item) => item.id === input.uid)
      if (!staff) throw new ApiError('not_found', 'That person is not on the staff list.')
      Object.assign(staff, { role: input.role ?? staff.role, active: Boolean(input.role), updatedAt: new Date().toISOString() })
      log('setStaffRole', input.role ? `Made ${staff.name} ${input.role}` : `Took staff access from ${staff.name}`, { kind: 'staff', id: staff.id })
      return staff
    },
  }

  const requireSignIn = () => {
    if (!signedIn) throw new ApiError('unauthorized', 'Sign in to continue.')
  }

  return {
    auth: {
      restore: () => respond(() => (signedIn ? ME : null)),
      signIn: (input) =>
        respond(() => {
          const parsed = signInSchema.safeParse(input)
          if (!parsed.success) throw validationError(parsed.error.issues, 'Check your email and password.')
          if (parsed.data.email !== MOCK_OPS.email || parsed.data.password !== MOCK_OPS.password) {
            throw new ApiError('unauthorized', 'That email and password do not match an Ops account.', { field: 'password' })
          }
          signedIn = true
          persist()
          return ME
        }),
      signOut: () =>
        respond(() => {
          signedIn = false
          persist()
        }),
    },

    overview: () =>
      respond(() => {
        requireSignIn()
        const paid = state.orders.filter((order) => order.status === 'paid')
        return {
          paidOrders: paid.length,
          revenue: { amount: paid.reduce((total, order) => total + order.total.amount, 0), currency: 'NGN' as const },
          ticketsIssued: state.tickets.filter((ticket) => ticket.status !== 'void').length,
          pendingOrders: state.orders.filter((order) => order.status === 'pending').length,
          refundsDue: state.orders.filter((order) => order.refundDue).length,
        }
      }),

    programme: () => respond(() => ({ screenings: state.screenings, events: seed.events, films: seed.films, venues: seed.venues, sections: seed.sections })),
    products: () => respond(() => state.products),
    updates: () => respond(() => [...state.updates].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))),

    orders: {
      recent: () => respond(() => state.orders.slice(0, 50)),
      search: (text) =>
        respond(() => {
          const parsed = parseOpsQuery(text)
          if (!parsed) throw new ApiError('validation', 'Search by order reference (AF-7KQ2P), ticket code (AF-7KQ2-P4NR) or email.', { field: 'query' })
          if (parsed.kind === 'reference') return state.orders.filter((order) => order.reference === parsed.value)
          if (parsed.kind === 'email') return state.orders.filter((order) => order.contact.email === parsed.value)
          const ticket = state.tickets.find((item) => item.code === parsed.value)
          return ticket ? state.orders.filter((order) => order.id === ticket.orderId) : []
        }),
      refundsDue: () => respond(() => state.orders.filter((order) => order.refundDue)),
      pending: () => respond(() => state.orders.filter((order) => order.status === 'pending')),
      get: (id) =>
        respond(() => ({
          order: findOrder(id),
          tickets: state.tickets.filter((ticket) => ticket.orderId === id),
          mail: state.mail.filter((mail) => mail.orderId === id).map(({ orderId: _orderId, ...mail }) => mail),
        })),
    },

    ticketsFor: (session) =>
      respond(() => state.tickets.filter((ticket) => (session.kind === 'screening' ? ticket.selection?.screeningId : ticket.selection?.eventId) === session.id)),
    doorCount: (session) => respond(() => state.counts[sessionKey(session)] ?? NO_COUNT),
    audit: () => respond(() => state.audit.slice(0, 200)),

    act: (action, input) =>
      respond(() => {
        requireSignIn()
        if (!canDo(ME.role, action)) throw new ApiError('unauthorized', 'Only an admin can do that.')
        const result = actions[action](input)
        persist()
        return result as never
      }),
  }
}

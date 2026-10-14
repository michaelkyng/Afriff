import { signInWithEmailAndPassword, signOut } from 'firebase/auth'
import type { Auth, User as Account } from 'firebase/auth'
import {
  collection,
  count,
  doc,
  getAggregateFromServer,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  sum,
  where,
} from 'firebase/firestore'
import type { DocumentData, Firestore, Query } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import type { Functions } from 'firebase/functions'
import { signInSchema } from '@afriff/validation'
import { ApiError, validationError } from '../contract'
import { isStaffRole, NO_COUNT, sessionKey } from '../door'
import type { StaffMember } from '../door'
import { canUseOps, parseOpsQuery } from '../ops'
import type { AuditEntry, OpsApi, OpsMail, OpsOrder, OpsTicket } from '../ops'
import type { FestivalEvent, FestivalUpdate, Film, Screening, Section, TicketProduct, Venue } from '../types'
import { toApiError } from './errors'
import { COLLECTIONS } from './schema'
import type { AuditDoc, DoorStatsDoc, MailDoc, OrderDoc, TicketDoc } from './schema'

/**
 * The Ops Console on Firebase. Reads straight from Firestore, which the rules
 * open to `ops` and `admin` staff; every change goes to the `ops` function,
 * which checks it and records it in the activity log.
 */
export interface FirebaseOpsOptions {
  auth: Auth
  db: Firestore
  functions: Functions
}

const NOT_OPS = () => new ApiError('unauthorized', 'This account is not set up for Ops. Ask an admin.', { field: 'email' })

/** Catalogue documents carry their list position; the console does not need it. */
function strip<T>(data: DocumentData): T {
  const { position: _position, ...rest } = data
  return rest as T
}

export function createFirebaseOpsApi({ auth, db, functions }: FirebaseOpsOptions): OpsApi {
  const callOps = httpsCallable<unknown, unknown>(functions, 'ops')

  async function staffOf(account: Account, fresh: boolean): Promise<StaffMember | null> {
    const { claims } = await account.getIdTokenResult(fresh)
    if (!isStaffRole(claims.role) || !canUseOps(claims.role)) return null
    return { id: account.uid, email: account.email ?? '', name: account.displayName || account.email || 'Ops', role: claims.role }
  }

  async function attempt<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work()
    }
    catch (error) {
      throw toApiError(error)
    }
  }

  const all = <T>(target: Query | string) =>
    getDocs(typeof target === 'string' ? collection(db, target) : target).then((snapshot) => snapshot.docs.map((item) => strip<T>(item.data())))

  const orders = collection(db, COLLECTIONS.orders)
  const tickets = collection(db, COLLECTIONS.tickets)
  const newestFirst = (list: OpsOrder[]) => list.sort((a, b) => b.placedAt.localeCompare(a.placedAt))

  return {
    auth: {
      async restore() {
        await auth.authStateReady()
        const account = auth.currentUser
        if (!account) return null
        const staff = await staffOf(account, navigator.onLine).catch(() => staffOf(account, false))
        if (!staff) await signOut(auth)
        return staff
      },

      signIn(input) {
        const parsed = signInSchema.safeParse(input)
        if (!parsed.success) return Promise.reject(validationError(parsed.error.issues, 'Check your email and password.'))
        return attempt(async () => {
          const { user } = await signInWithEmailAndPassword(auth, parsed.data.email, parsed.data.password)
          const staff = await staffOf(user, true)
          if (staff) return staff
          await signOut(auth)
          throw NOT_OPS()
        })
      },

      signOut: () => attempt(() => signOut(auth)),
    },

    overview: () =>
      attempt(async () => {
        // Counted and summed on the server: no order is downloaded to make a total.
        const [paid, issued, pending, refunds] = await Promise.all([
          getAggregateFromServer(query(orders, where('status', '==', 'paid')), { orders: count(), revenue: sum('total.amount') }),
          getCountFromServer(query(tickets, where('status', 'in', ['valid', 'used', 'transferred']))),
          getCountFromServer(query(orders, where('status', '==', 'pending'))),
          getCountFromServer(query(orders, where('refundDue', '==', true))),
        ])
        return {
          paidOrders: paid.data().orders,
          revenue: { amount: paid.data().revenue, currency: 'NGN' as const },
          ticketsIssued: issued.data().count,
          pendingOrders: pending.data().count,
          refundsDue: refunds.data().count,
        }
      }),

    programme: () =>
      attempt(async () => {
        const [screenings, events, films, venues, sections] = await Promise.all([
          all<Screening>(COLLECTIONS.screenings),
          all<FestivalEvent>(COLLECTIONS.events),
          all<Film>(COLLECTIONS.films),
          all<Venue>(COLLECTIONS.venues),
          all<Section>(COLLECTIONS.sections),
        ])
        return { screenings: screenings.sort((a, b) => a.startsAt.localeCompare(b.startsAt)), events, films, venues, sections }
      }),

    products: () => attempt(() => all<TicketProduct>(COLLECTIONS.products)),

    updates: () =>
      attempt(async () => (await all<FestivalUpdate>(COLLECTIONS.updates)).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))),

    orders: {
      recent: () => attempt(async () => all<OpsOrder>(query(orders, orderBy('placedAt', 'desc'), limit(50)))),

      search: (text) =>
        attempt(async () => {
          const parsed = parseOpsQuery(text)
          if (!parsed) throw new ApiError('validation', 'Search by order reference (AF-7KQ2P), ticket code (AF-7KQ2-P4NR) or email.', { field: 'query' })
          if (parsed.kind === 'reference') return all<OpsOrder>(query(orders, where('reference', '==', parsed.value)))
          if (parsed.kind === 'email') return newestFirst(await all<OpsOrder>(query(orders, where('contact.email', '==', parsed.value))))
          const [ticket] = await all<OpsTicket>(query(tickets, where('code', '==', parsed.value), limit(1)))
          if (!ticket) return []
          const order = await getDoc(doc(orders, ticket.orderId))
          return order.exists() ? [order.data() as OpsOrder] : []
        }),

      refundsDue: () => attempt(async () => newestFirst(await all<OpsOrder>(query(orders, where('refundDue', '==', true))))),

      pending: () => attempt(async () => newestFirst(await all<OpsOrder>(query(orders, where('status', '==', 'pending'))))),

      get: (id) =>
        attempt(async () => {
          const snapshot = await getDoc(doc(orders, id))
          if (!snapshot.exists()) throw new ApiError('not_found', 'We could not find that order.', { id })
          const [orderTickets, mail] = await Promise.all([
            all<OpsTicket>(query(tickets, where('orderId', '==', id))),
            getDocs(query(collection(db, COLLECTIONS.mail), where('orderId', '==', id))),
          ])
          return {
            order: snapshot.data() as OpsOrder,
            tickets: orderTickets.sort((a, b) => a.issuedAt.localeCompare(b.issuedAt)),
            mail: mail.docs
              .map((item): OpsMail => {
                const data = item.data() as MailDoc
                return { id: item.id, template: data.template, to: data.to.email, status: data.status, createdAt: data.createdAt, sentAt: data.sentAt, error: data.error }
              })
              .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
          }
        }),
    },

    ticketsFor: (session) =>
      attempt(() => all<OpsTicket>(query(tickets, where(session.kind === 'screening' ? 'selection.screeningId' : 'selection.eventId', '==', session.id)))),

    doorCount: (session) =>
      attempt(async () => {
        const stats = (await getDoc(doc(db, COLLECTIONS.doorStats, sessionKey(session)))).data() as DoorStatsDoc | undefined
        return { admitted: stats?.admitted ?? NO_COUNT.admitted, passAdmitted: stats?.passAdmitted ?? NO_COUNT.passAdmitted }
      }),

    audit: () =>
      attempt(async () => {
        const snapshot = await getDocs(query(collection(db, COLLECTIONS.audit), orderBy('at', 'desc'), limit(200)))
        return snapshot.docs.map((item): AuditEntry => {
          const { before: _before, after: _after, ...entry } = item.data() as AuditDoc
          return { id: item.id, ...entry }
        })
      }),

    act: (action, input) =>
      attempt(async () => {
        if (!auth.currentUser) throw new ApiError('unauthorized', 'Sign in to continue.')
        // Undefined fields would arrive as null; drop them, as the other callables do.
        const request = JSON.parse(JSON.stringify({ ...input, action }))
        return (await callOps(request)).data as never
      }),
  }
}

import {
  applyActionCode,
  confirmPasswordReset,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile as updateAccountName,
  verifyPasswordResetCode,
} from 'firebase/auth'
import type { Auth, User as Account } from 'firebase/auth'
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'
import type { DocumentSnapshot, Firestore } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import type { Functions } from 'firebase/functions'
import {
  deviceSchema,
  passwordResetRequestSchema,
  passwordResetSchema,
  profileSchema,
  savedItemSchema,
  savedMergeSchema,
  signInSchema,
  signUpSchema,
} from '@afriff/validation'
import { ApiError, validationError } from '../contract'
import type { AttendeeApi } from '../contract'
import { selectFilms, selectScreenings } from '../queries'
import type {
  CheckoutInput,
  DeviceInput,
  Festival,
  FestivalEvent,
  FestivalInfo,
  FestivalUpdate,
  Film,
  FilmQuery,
  Order,
  PasswordResetInput,
  PasswordResetRequestInput,
  ProfileInput,
  SavedInput,
  SavedItem,
  Screening,
  ScreeningQuery,
  Section,
  SignInInput,
  SignUpInput,
  Ticket,
  TicketProduct,
  TicketTransferInput,
  User,
  Venue,
} from '../types'
import { isPermissionDenied, toApiError } from './errors'
import { COLLECTIONS, CURRENT, savedDocId } from './schema'
import type { CallableContract, CallableName, OrderDoc, Positioned, SavedDoc, TicketDoc, UserDoc } from './schema'

export { DEFAULT_FUNCTIONS_REGION } from './schema'

/**
 * The attendee API on Firebase: Auth for accounts, Firestore for what can be read
 * directly (guarded by `firebase/firestore.rules`), and callable Cloud Functions
 * for anything that moves money or stock.
 *
 * The app creates the SDK instances (see `@afriff/firebase`) and hands them in;
 * this module never reads configuration or touches the DOM.
 */
export interface FirebaseApiOptions {
  auth: Auth
  db: Firestore
  functions: Functions
  /**
   * Where the links in account emails lead back to, e.g. `https://app.afriff.com`.
   * Its domain must be on Firebase Auth's list of authorised domains.
   */
  appUrl: string
}

const SAVED_LIMIT = 200

const NOT_SIGNED_IN = () => new ApiError('unauthorized', 'Sign in to continue.')

/** Catalogue documents carry their place in the list; the app sees the model alone. */
function byPosition<T>(snapshots: DocumentSnapshot[]): T[] {
  return snapshots
    .map((snapshot) => snapshot.data() as T & Partial<Positioned>)
    .sort((a, b) => (a.position ?? Number.MAX_SAFE_INTEGER) - (b.position ?? Number.MAX_SAFE_INTEGER))
    .map(({ position: _position, ...item }) => item as T)
}

function iso(value: { toDate(): Date } | null | undefined): string {
  return (value?.toDate() ?? new Date()).toISOString()
}

/** Orders and tickets are stored with an owner and bookkeeping; the app never sees it. */
function toOrder({ userId: _u, holds: _h, attempts: _a, refundDue: _r, duplicatePayments: _d, updatedAt: _t, ...order }: OrderDoc): Order {
  return order
}

function toTicket({ userId: _u, claimEmail: _c, ...ticket }: TicketDoc): Ticket {
  return ticket
}

/** For an account whose profile was never written: the name it was created with, else a placeholder to edit. */
function namesFrom(displayName: string | null): { firstName: string; lastName: string } {
  const [first, ...rest] = (displayName ?? '').trim().split(/\s+/).filter(Boolean)
  return {
    firstName: (first ?? 'Festival').slice(0, 30),
    lastName: (rest.join(' ') || 'Guest').slice(0, 30),
  }
}

export function createFirebaseApi({ auth, db, functions, appUrl }: FirebaseApiOptions): AttendeeApi {
  const origin = appUrl.replace(/\/+$/, '')

  // ---------------------------------------------------------------- accounts

  const profileRef = (uid: string) => doc(db, COLLECTIONS.users, uid)

  function toUser(account: Account, profile: UserDoc): User {
    return {
      id: account.uid,
      email: account.email ?? profile.email,
      emailVerified: account.emailVerified,
      firstName: profile.firstName,
      lastName: profile.lastName,
      name: profile.name,
      ...(profile.phone ? { phone: profile.phone } : {}),
      createdAt: iso(profile.createdAt),
    }
  }

  async function writeProfile(account: Account, names: { firstName: string; lastName: string }): Promise<User> {
    const name = `${names.firstName} ${names.lastName}`
    await setDoc(profileRef(account.uid), {
      email: account.email,
      firstName: names.firstName,
      lastName: names.lastName,
      name,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    return {
      id: account.uid,
      email: account.email ?? '',
      emailVerified: account.emailVerified,
      ...names,
      name,
      createdAt: new Date().toISOString(),
    }
  }

  async function loadUser(account: Account): Promise<User> {
    const snapshot = await getDoc(profileRef(account.uid))
    if (snapshot.exists()) return toUser(account, snapshot.data({ serverTimestamps: 'estimate' }) as UserDoc)
    // Signed up, but the connection went before the profile was written.
    return writeProfile(account, namesFrom(account.displayName))
  }

  /**
   * Picks up changes made elsewhere — an email confirmed on another device — and
   * refreshes the ID token when that changes what the rules see in it.
   */
  async function refreshAccount(account: Account) {
    await reload(account)
    if (account.emailVerified && (await account.getIdTokenResult()).claims.email_verified !== true) {
      await account.getIdToken(true)
    }
  }

  function requireAccount(): Account {
    const account = auth.currentUser
    if (!account) throw NOT_SIGNED_IN()
    return account
  }

  /**
   * The uid last reported to the app. Undefined until `restore()` has run, so the
   * SDK's first report on start-up is not mistaken for a change.
   */
  let known: string | null | undefined
  /** Calls in flight that sign in or out; their own state changes are not news. */
  let busy = 0
  const listeners = new Set<(user: User | null) => void>()

  onAuthStateChanged(auth, async (account) => {
    if (known === undefined || busy > 0) return
    const uid = account?.uid ?? null
    if (uid === known) return
    known = uid
    if (!account) {
      listeners.forEach((listener) => listener(null))
      return
    }
    try {
      const user = await loadUser(account)
      listeners.forEach((listener) => listener(user))
    }
    catch {
      // The next start-up restores it properly.
    }
  })

  async function changingSession<T>(work: () => Promise<T>): Promise<T> {
    busy += 1
    try {
      return await work()
    }
    catch (error) {
      throw toApiError(error)
    }
    finally {
      busy -= 1
      known = auth.currentUser?.uid ?? null
    }
  }

  async function attempt<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work()
    }
    catch (error) {
      throw toApiError(error)
    }
  }

  const authApi: AttendeeApi['auth'] = {
    async restore() {
      await auth.authStateReady()
      const account = auth.currentUser
      known = account?.uid ?? null
      if (!account) return null
      return attempt(() => loadUser(account))
    },

    onSessionChange(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },

    signIn(input: SignInInput) {
      const parsed = signInSchema.safeParse(input)
      if (!parsed.success) return Promise.reject(validationError(parsed.error.issues, 'Check your email and password.'))
      const { email, password } = parsed.data
      return changingSession(async () => loadUser((await signInWithEmailAndPassword(auth, email, password)).user))
    },

    signUp(input: SignUpInput) {
      const parsed = signUpSchema.safeParse(input)
      if (!parsed.success) return Promise.reject(validationError(parsed.error.issues, 'Check your details and try again.'))
      const { email, password, firstName, lastName } = parsed.data
      return changingSession(async () => {
        const { user: account } = await createUserWithEmailAndPassword(auth, email, password)
        // The name goes on the account first, so a profile lost to a dropped connection can be rebuilt from it.
        await updateAccountName(account, { displayName: `${firstName} ${lastName}` })
        const user = await writeProfile(account, { firstName, lastName })
        // The account is usable either way; the Me tab offers to send the link again.
        await sendEmailVerification(account, { url: `${origin}/me` }).catch(() => {})
        return user
      })
    },

    requestPasswordReset(input: PasswordResetRequestInput) {
      const parsed = passwordResetRequestSchema.safeParse(input)
      if (!parsed.success) return Promise.reject(validationError(parsed.error.issues, 'Enter a valid email address.'))
      const { email } = parsed.data
      return attempt(async () => {
        try {
          await sendPasswordResetEmail(auth, email, { url: `${origin}/signin` })
        }
        catch (error) {
          // Projects without email enumeration protection say so; the answer stays the same.
          if (!(error instanceof Error && 'code' in error && error.code === 'auth/user-not-found')) throw error
        }
        return { email }
      })
    },

    checkPasswordReset: (code: string) => attempt(async () => ({ email: await verifyPasswordResetCode(auth, code.trim()) })),

    resetPassword(input: PasswordResetInput) {
      const parsed = passwordResetSchema.safeParse(input)
      if (!parsed.success) return Promise.reject(validationError(parsed.error.issues, 'Choose a new password.'))
      const { code, password } = parsed.data
      return changingSession(async () => {
        const email = await verifyPasswordResetCode(auth, code)
        await confirmPasswordReset(auth, code, password)
        return loadUser((await signInWithEmailAndPassword(auth, email, password)).user)
      })
    },

    sendEmailVerification: () =>
      attempt(async () => {
        const account = requireAccount()
        await reload(account)
        if (!account.emailVerified) await sendEmailVerification(account, { url: `${origin}/me` })
        return { email: account.email ?? '' }
      }),

    verifyEmail: (code: string) =>
      attempt(async () => {
        await applyActionCode(auth, code.trim())
        if (auth.currentUser) await refreshAccount(auth.currentUser)
      }),

    me: () =>
      attempt(async () => {
        const account = requireAccount()
        await refreshAccount(account).catch(() => {})
        return loadUser(account)
      }),

    updateProfile(input: ProfileInput) {
      const parsed = profileSchema.safeParse(input)
      if (!parsed.success) return Promise.reject(validationError(parsed.error.issues, 'Check the details and try again.'))
      const { firstName, lastName } = parsed.data
      const phone = parsed.data.phone?.trim()
      return attempt(async () => {
        const account = requireAccount()
        await updateDoc(profileRef(account.uid), {
          firstName,
          lastName,
          name: `${firstName} ${lastName}`,
          phone: phone || deleteField(),
          updatedAt: serverTimestamp(),
        })
        await updateAccountName(account, { displayName: `${firstName} ${lastName}` }).catch(() => {})
        return loadUser(account)
      })
    },

    signOut: () => changingSession(() => signOut(auth)),
  }

  // ---------------------------------------------------------------- catalogue

  const listOf = <T>(name: string) =>
    attempt(async () => byPosition<T>((await getDocs(collection(db, name))).docs))

  async function single<T>(name: string, missing: string): Promise<T> {
    const snapshot = await attempt(() => getDoc(doc(db, name, CURRENT)))
    if (!snapshot.exists()) throw new ApiError('not_found', missing)
    return snapshot.data() as T
  }

  // ---------------------------------------------------------------- functions

  function call<N extends CallableName>(name: N) {
    const callable = httpsCallable<CallableContract[N]['request'], CallableContract[N]['response']>(functions, name)
    return (request: CallableContract[N]['request']) =>
      attempt(async () => {
        requireAccount()
        // The SDK sends an undefined field as null, which the shared schemas rightly
        // refuse (`selection: null` is not "no selection"). Requests are plain data,
        // so a JSON round trip drops those fields, as the mock never sees them.
        return (await callable(JSON.parse(JSON.stringify(request)))).data
      })
  }

  const checkout = call('checkout')
  const payOrder = call('payOrder')
  const verifyOrder = call('verifyOrder')
  const transferTicket = call('transferTicket')
  const claimTickets = call('claimTickets')

  /** An order or ticket that is not the attendee's is refused by the rules; to them it does not exist. */
  async function ownDoc<T extends { userId: string | null }>(name: string, id: string, missing: string): Promise<T> {
    const account = requireAccount()
    try {
      const snapshot = await getDoc(doc(db, name, id))
      const data = snapshot.data() as T | undefined
      if (data && data.userId === account.uid) return data
    }
    catch (error) {
      if (!isPermissionDenied(error)) throw toApiError(error)
    }
    throw new ApiError('not_found', missing, { id })
  }

  // ---------------------------------------------------------------- saved

  const savedOf = (uid: string) => collection(db, COLLECTIONS.users, uid, COLLECTIONS.saved)

  async function savedList(uid: string): Promise<SavedItem[]> {
    const snapshot = await getDocs(savedOf(uid))
    return snapshot.docs
      .map((item) => item.data({ serverTimestamps: 'estimate' }) as SavedDoc)
      .map(({ kind, refId, savedAt }) => ({ kind, refId, savedAt: iso(savedAt) }))
      .sort((a, b) => b.savedAt.localeCompare(a.savedAt))
  }

  /** The rules refuse an id that is not in the programme, which to the attendee means it has gone. */
  async function putSaved(uid: string, kind: SavedItem['kind'], refId: string) {
    try {
      await setDoc(doc(savedOf(uid), savedDocId(kind, refId)), { kind, refId, savedAt: serverTimestamp() })
    }
    catch (error) {
      if (isPermissionDenied(error)) throw new ApiError('not_found', 'That is no longer in the programme.', { kind, refId })
      throw error
    }
  }

  return {
    auth: authApi,

    festival: {
      get: () => single<Festival>(COLLECTIONS.festival, 'The festival programme has not been published yet.'),
    },

    programme: {
      listVenues: () => listOf<Venue>(COLLECTIONS.venues),
      listSections: () => listOf<Section>(COLLECTIONS.sections),
      listFilms: async (filmQuery: FilmQuery = {}) => selectFilms(await listOf<Film>(COLLECTIONS.films), filmQuery),

      getFilm: (slug: string) =>
        attempt(async () => {
          const snapshot = await getDocs(query(collection(db, COLLECTIONS.films), where('slug', '==', slug), limit(1)))
          const [found] = byPosition<Film>(snapshot.docs)
          if (!found) throw new ApiError('not_found', `No film found for “${slug}”.`, { slug })
          return found
        }),

      listScreenings: async (screeningQuery: ScreeningQuery = {}) =>
        selectScreenings(await listOf<Screening>(COLLECTIONS.screenings), screeningQuery),

      listEvents: () => listOf<FestivalEvent>(COLLECTIONS.events),
    },

    catalog: {
      listProducts: () => listOf<TicketProduct>(COLLECTIONS.products),
    },

    info: {
      get: () => single<FestivalInfo>(COLLECTIONS.info, 'Festival information has not been published yet.'),
    },

    updates: {
      list: async () =>
        (await listOf<FestivalUpdate>(COLLECTIONS.updates)).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)),
    },

    orders: {
      checkout: (input: CheckoutInput) => checkout(input),

      list: () =>
        attempt(async () => {
          const account = requireAccount()
          const snapshot = await getDocs(query(collection(db, COLLECTIONS.orders), where('userId', '==', account.uid)))
          return snapshot.docs
            .map((item) => toOrder(item.data() as OrderDoc))
            .sort((a, b) => b.placedAt.localeCompare(a.placedAt))
        }),

      get: async (id: string) => toOrder(await ownDoc<OrderDoc>(COLLECTIONS.orders, id, 'We could not find that order.')),

      pay: (orderId: string) => payOrder({ orderId }),

      verify: (orderId: string) => verifyOrder({ orderId }),
    },

    tickets: {
      list: () =>
        attempt(async () => {
          const account = requireAccount()
          const tickets = collection(db, COLLECTIONS.tickets)
          const own = await getDocs(query(tickets, where('userId', '==', account.uid)))
          let waiting: TicketDoc[] = []
          // Tickets passed on to this email before it had an account. The rules only
          // show them to a confirmed address, and only the server can hand them over.
          if (account.emailVerified && account.email) {
            try {
              const snapshot = await getDocs(
                query(tickets, where('claimEmail', '==', account.email), where('userId', '==', null)),
              )
              waiting = snapshot.docs.map((item) => item.data() as TicketDoc)
            }
            catch {
              // The token may not carry the confirmation yet; they turn up next time.
            }
            if (waiting.length) claimTickets({}).catch(() => {})
          }
          return [...own.docs.map((item) => item.data() as TicketDoc), ...waiting]
            .map(toTicket)
            .sort((a, b) => (a.startsAt ?? '').localeCompare(b.startsAt ?? ''))
        }),

      get: async (id: string) => toTicket(await ownDoc<TicketDoc>(COLLECTIONS.tickets, id, 'We could not find that ticket.')),

      transfer: (id: string, input: TicketTransferInput) => transferTicket({ ticketId: id, ...input }),
    },

    notifications: {
      saveDevice: (input: DeviceInput) =>
        attempt(async () => {
          const { uid } = requireAccount()
          const parsed = deviceSchema.safeParse(input)
          if (!parsed.success) throw validationError(parsed.error.issues, 'We could not save this device.')
          const { deviceId, token, kinds, reminders, label } = parsed.data
          // One whole record each time: the rules check its shape, and the server time stamps it.
          await setDoc(doc(db, COLLECTIONS.users, uid, COLLECTIONS.devices, deviceId), {
            token,
            kinds,
            reminders,
            ...(label ? { label } : {}),
            updatedAt: serverTimestamp(),
          })
        }),

      removeDevice: (deviceId: string) =>
        attempt(async () => {
          const { uid } = requireAccount()
          await deleteDoc(doc(db, COLLECTIONS.users, uid, COLLECTIONS.devices, deviceId))
        }),
    },

    saved: {
      list: () => attempt(() => savedList(requireAccount().uid)),

      add: (input: SavedInput) =>
        attempt(async () => {
          const { uid } = requireAccount()
          const parsed = savedItemSchema.safeParse(input)
          if (!parsed.success) throw validationError(parsed.error.issues, 'We could not save that.')
          const { kind, refId } = parsed.data
          const current = await savedList(uid)
          // Already saved is not an error, and writing it again would move it up the list.
          if (current.some((item) => item.kind === kind && item.refId === refId)) return current
          if (current.length >= SAVED_LIMIT) {
            throw new ApiError('conflict', 'That is as much as one plan can hold.', { limit: SAVED_LIMIT })
          }
          await putSaved(uid, kind, refId)
          return savedList(uid)
        }),

      remove: (input: SavedInput) =>
        attempt(async () => {
          const { uid } = requireAccount()
          const parsed = savedItemSchema.safeParse(input)
          if (!parsed.success) throw new ApiError('validation', 'We could not remove that.')
          await deleteDoc(doc(savedOf(uid), savedDocId(parsed.data.kind, parsed.data.refId)))
          return savedList(uid)
        }),

      merge: (inputs: SavedInput[]) =>
        attempt(async () => {
          const { uid } = requireAccount()
          const parsed = savedMergeSchema.safeParse(inputs)
          if (!parsed.success) throw new ApiError('validation', 'We could not take that list.')
          const current = await savedList(uid)
          const have = new Set(current.map((item) => savedDocId(item.kind, item.refId)))
          const missing = parsed.data
            .filter((item) => {
              const id = savedDocId(item.kind, item.refId)
              if (have.has(id)) return false
              have.add(id)
              return true
            })
            .slice(0, Math.max(0, SAVED_LIMIT - current.length))
          // Anything the programme has dropped is refused by the rules and skipped, not fatal.
          await Promise.allSettled(missing.map((item) => putSaved(uid, item.kind, item.refId)))
          return savedList(uid)
        }),
    },
  }
}

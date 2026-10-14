import { signInWithEmailAndPassword, signOut } from 'firebase/auth'
import type { Auth, User as Account } from 'firebase/auth'
import { collection, doc, getDocs, onSnapshot } from 'firebase/firestore'
import type { Firestore } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import type { Functions } from 'firebase/functions'
import { signInSchema } from '@afriff/validation'
import { ApiError, validationError } from '../contract'
import { doorSessions, isStaffRole, NO_COUNT, sessionKey } from '../door'
import type { CheckInInput, CheckInResult, DoorApi, DoorCount, StaffMember } from '../door'
import type { FestivalEvent, Film, Screening, Venue } from '../types'
import { toApiError } from './errors'
import { COLLECTIONS } from './schema'
import type { CallableContract, DoorStatsDoc } from './schema'

/**
 * The door on Firebase. Staff sign in with Firebase Auth and carry a `role`
 * claim (set by `bun run staff`); scans go to the `checkIn` function, and the
 * running count is followed live from `doorStats`, which every door adds to.
 */
export interface FirebaseDoorOptions {
  auth: Auth
  db: Firestore
  functions: Functions
}

const NOT_STAFF = () =>
  new ApiError('unauthorized', 'This account is not set up for door duty. Ask the festival team to add you.', { field: 'email' })

export function createFirebaseDoorApi({ auth, db, functions }: FirebaseDoorOptions): DoorApi {
  const callCheckIn = httpsCallable<CallableContract['checkIn']['request'], CallableContract['checkIn']['response']>(functions, 'checkIn')

  /** Reads the role from the token. `fresh` asks the server, so a role just given or taken away counts at once. */
  async function staffOf(account: Account, fresh: boolean): Promise<StaffMember | null> {
    const { claims } = await account.getIdTokenResult(fresh)
    if (!isStaffRole(claims.role)) return null
    return {
      id: account.uid,
      email: account.email ?? '',
      name: account.displayName || (account.email ?? '').split('@')[0] || 'Door',
      role: claims.role,
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

  return {
    auth: {
      async restore() {
        await auth.authStateReady()
        const account = auth.currentUser
        if (!account) return null
        // Offline, the cached token stands; the server checks the role on every scan anyway.
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
          throw NOT_STAFF()
        })
      },

      signOut: () => attempt(() => signOut(auth)),
    },

    sessions: () =>
      attempt(async () => {
        const [screenings, events, films, venues] = await Promise.all(
          [COLLECTIONS.screenings, COLLECTIONS.events, COLLECTIONS.films, COLLECTIONS.venues].map((name) =>
            getDocs(collection(db, name)).then((snapshot) => snapshot.docs.map((item) => item.data())),
          ),
        )
        return doorSessions({
          screenings: screenings as Screening[],
          events: events as FestivalEvent[],
          films: films as Film[],
          venues: venues as Venue[],
        })
      }),

    checkIn: (input: CheckInInput) =>
      attempt(async (): Promise<CheckInResult> => {
        if (!auth.currentUser) throw new ApiError('unauthorized', 'Sign in to continue.')
        // Undefined fields would reach the function as null; drop them, as the API's other callables do.
        return (await callCheckIn(JSON.parse(JSON.stringify(input)))).data
      }),

    watchCount(ref, listener: (count: DoorCount) => void) {
      return onSnapshot(
        doc(db, COLLECTIONS.doorStats, sessionKey(ref)),
        (snapshot) => {
          const stats = snapshot.data() as DoorStatsDoc | undefined
          listener({ admitted: stats?.admitted ?? NO_COUNT.admitted, passAdmitted: stats?.passAdmitted ?? NO_COUNT.passAdmitted })
        },
        // Offline or signed out: the count from each scan's result still shows.
        () => {},
      )
    },
  }
}

import { isApiError } from '@afriff/api'
import type {
  AuthSession,
  CodePurpose,
  ProfileInput,
  SetPinInput,
  SignInInput,
  User,
  VerifyCodeInput,
} from '@afriff/api'

/** Initials for the avatar: two from the name, else the first letter of the email. */
export function initialsOf(user: Pick<User, 'name' | 'email'> | null | undefined): string {
  if (!user) return ''
  const parts = user.name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0]![0]! + parts.at(-1)![0]!).toUpperCase()
  if (parts[0]) return parts[0].slice(0, 2).toUpperCase()
  return user.email.slice(0, 1).toUpperCase()
}

/**
 * Where to land once the attendee is in, and how to keep that destination while
 * they hop between sign in, sign up and PIN reset. Only same-app paths are
 * followed, so `?redirect=` cannot bounce anyone off the site.
 */
export function useAuthRedirect() {
  const route = useRoute()

  const redirect = computed(() => {
    const target = route.query.redirect
    return typeof target === 'string' && target.startsWith('/') && !target.startsWith('//') ? target : '/me'
  })

  /** Carries a valid redirect onto the other auth pages; undefined when there is none. */
  const query = computed(() => (route.query.redirect === redirect.value ? { redirect: redirect.value } : undefined))

  return { redirect, query }
}

/**
 * Account state and the ways into it. Signing in takes an email and a PIN;
 * `requestCode` → `verifyCode` → `setPin` is how a PIN is set in the first
 * place, whether signing up or replacing a forgotten one.
 *
 * The API adapter holds the token for its own calls; this keeps the persisted
 * store and the adapter in step.
 */
export function useAuth() {
  const api = useApi()
  const session = useSessionStore()

  const user = computed(() => session.user)
  const isSignedIn = computed(() => session.isSignedIn)
  const initials = computed(() => initialsOf(session.user))

  /** Hands a new session to both the adapter and the persisted store. */
  function adopt(result: AuthSession) {
    api.setAuthToken(result.token)
    session.signIn(result)
    return result
  }

  async function signIn(input: SignInInput) {
    return adopt(await api.auth.signIn(input))
  }

  /** Asks for a one-time code. In mock mode the challenge carries the code to show. */
  function requestCode(email: string, purpose: CodePurpose) {
    return api.auth.requestCode({ email, purpose })
  }

  /** Trades the code for a short-lived ticket that authorises setting a PIN. */
  function verifyCode(input: VerifyCodeInput) {
    return api.auth.verifyCode(input)
  }

  /** Finishes a sign-up or a PIN reset, and signs in with the PIN just set. */
  async function setPin(input: SetPinInput) {
    return adopt(await api.auth.setPin(input))
  }

  async function updateProfile(input: ProfileInput) {
    const updated = await api.auth.updateProfile(input)
    session.setUser(updated)
    return updated
  }

  async function signOut() {
    try {
      await api.auth.signOut()
    }
    catch {
      // Already gone on the server: sign out locally anyway.
    }
    api.setAuthToken(null)
    session.signOut()
  }

  /** Confirms a restored token still works, and clears the session when it does not. */
  async function restore() {
    if (!session.token) return
    api.setAuthToken(session.token)
    try {
      session.setUser(await api.auth.me())
    }
    catch (error) {
      if (isApiError(error) && error.code === 'unauthorized') {
        api.setAuthToken(null)
        session.signOut()
      }
    }
  }

  return {
    user,
    isSignedIn,
    initials,
    signIn,
    requestCode,
    verifyCode,
    setPin,
    updateProfile,
    signOut,
    restore,
  }
}

import { isApiError } from '@afriff/api'
import type { PasswordResetInput, ProfileInput, SignInInput, SignUpInput, User } from '@afriff/api'

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
 * they hop between sign in, sign up and password reset. Only same-app paths are
 * followed, so `?redirect=` cannot bounce anyone off the site.
 */
export function useAuthRedirect() {
  const route = useRoute()

  const redirect = computed(() => authRedirect(route.query.redirect))

  /** Carries a valid redirect onto the other auth pages; undefined when there is none. */
  const query = computed(() => (route.query.redirect === redirect.value ? { redirect: redirect.value } : undefined))

  return { redirect, query }
}

/**
 * The email typed on one sign-in screen, so moving to "Create an account" or
 * "Forgot your password?" does not mean typing it again. Never persisted.
 */
export function useAuthEmail() {
  return useState('auth:email', () => '')
}

/**
 * Account state and the ways into it: an email and a password, a reset link for a
 * forgotten password, and a link to confirm the email address.
 *
 * The API adapter owns the session; this keeps the device's copy of the account
 * (the `session` store) and the saved plan in step with it.
 */
export function useAuth() {
  const api = useApi()
  const session = useSessionStore()
  const push = usePush()

  const user = computed(() => session.user)
  const isSignedIn = computed(() => session.isSignedIn)
  const initials = computed(() => initialsOf(session.user))

  /** Takes the signed-in attendee, and folds whatever was saved while signed out into the account. */
  function adopt(next: User): User {
    session.setUser(next)
    usePlanStore().sync()
    return next
  }

  /** Signing out leaves the account's plan with the account, not on the device, and its notifications too. */
  function forget() {
    session.signOut()
    usePlanStore().clear()
    void push.forget()
  }

  async function signIn(input: SignInInput) {
    return adopt(await api.auth.signIn(input))
  }

  /** Creates the account and signs it in; the adapter sends the confirmation link. */
  async function signUp(input: SignUpInput) {
    return adopt(await api.auth.signUp(input))
  }

  function requestPasswordReset(email: string) {
    return api.auth.requestPasswordReset({ email })
  }

  function checkPasswordReset(code: string) {
    return api.auth.checkPasswordReset(code)
  }

  /** Sets the new password and signs in with it. */
  async function resetPassword(input: PasswordResetInput) {
    return adopt(await api.auth.resetPassword(input))
  }

  function sendEmailVerification() {
    return api.auth.sendEmailVerification()
  }

  /** Applies a confirmation link, and refreshes the account if it is this one. */
  async function verifyEmail(code: string) {
    await api.auth.verifyEmail(code)
    if (session.user) await refresh().catch(() => {})
  }

  /** Fetches the account again, to pick up anything changed elsewhere (an email confirmed on another device). */
  async function refresh() {
    session.setUser(await api.auth.me())
  }

  async function updateProfile(input: ProfileInput) {
    const updated = await api.auth.updateProfile(input)
    session.setUser(updated)
    return updated
  }

  async function signOut() {
    await push.release()
    try {
      await api.auth.signOut()
    }
    catch {
      // Already gone on the server: sign out locally anyway.
    }
    forget()
  }

  /**
   * Asks the adapter who is signed in. Offline, with a session the adapter could
   * not load, the device's copy stands rather than signing anyone out.
   */
  async function restore() {
    try {
      const restored = await api.auth.restore()
      if (restored) adopt(restored)
      else forget()
    }
    catch (error) {
      if (isApiError(error) && error.code === 'unauthorized') forget()
    }
  }

  /** Follows session changes the adapter reports from outside this tab. Call once, on start-up. */
  function follow() {
    api.auth.onSessionChange((next) => (next ? adopt(next) : forget()))
  }

  return {
    user,
    isSignedIn,
    initials,
    signIn,
    signUp,
    requestPasswordReset,
    checkPasswordReset,
    resetPassword,
    sendEmailVerification,
    verifyEmail,
    refresh,
    updateProfile,
    signOut,
    restore,
    follow,
  }
}

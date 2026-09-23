import type { AuthSession, User } from '@afriff/api'

/**
 * The signed-in attendee, persisted to localStorage under `afriff:session`.
 * The token is sent with authenticated API calls; `app/plugins/auth.client.ts`
 * restores it on start-up and checks it is still valid.
 */
export const useSessionStore = defineStore(
  'session',
  () => {
    const token = ref<string | null>(null)
    const user = ref<User | null>(null)

    const isSignedIn = computed(() => Boolean(token.value && user.value))

    function signIn(session: AuthSession) {
      token.value = session.token
      user.value = session.user
    }

    function setUser(value: User) {
      user.value = value
    }

    function signOut() {
      token.value = null
      user.value = null
    }

    return { token, user, isSignedIn, signIn, setUser, signOut }
  },
  { persist: true },
)

import type { User } from '@afriff/api'

/**
 * The signed-in attendee, kept on the device under `afriff:session` so the app
 * opens straight into the account, offline too.
 *
 * It is a copy, not the session: the API adapter holds that (Firebase keeps and
 * refreshes its own tokens), and `app/plugins/auth.client.ts` checks this copy
 * against it on every start-up.
 */
export const useSessionStore = defineStore(
  'session',
  () => {
    const user = ref<User | null>(null)

    const isSignedIn = computed(() => Boolean(user.value))

    function setUser(value: User) {
      user.value = value
    }

    function signOut() {
      user.value = null
    }

    return { user, isSignedIn, setUser, signOut }
  },
  // Only the account. Older builds also kept a token here; it is ignored.
  { persist: { pick: ['user'] } },
)

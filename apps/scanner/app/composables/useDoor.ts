import { isApiError } from '@afriff/api'
import type { DoorApi, StaffMember } from '@afriff/api/door'

/** The door API. Pages use this rather than importing an adapter. */
export function useDoor(): DoorApi {
  return useNuxtApp().$door
}

/**
 * The staff member signed in on this device. Kept in memory only: the adapter
 * holds the session, and nobody's identity should outlive it on a shared phone.
 */
export function useStaff() {
  const door = useDoor()
  const staff = useState<StaffMember | null>('door:staff', () => null)

  async function restore() {
    try {
      staff.value = await door.auth.restore()
    }
    catch (error) {
      if (isApiError(error) && error.code === 'unauthorized') staff.value = null
    }
  }

  async function signIn(email: string, password: string) {
    staff.value = await door.auth.signIn({ email, password })
  }

  async function signOut() {
    await door.auth.signOut().catch(() => {})
    staff.value = null
    await navigateTo('/signin', { replace: true })
  }

  return { staff, restore, signIn, signOut }
}

/** Every screening and event, loaded once and shared by the session list and the scanner. */
export function useDoorSessions() {
  const door = useDoor()
  return useAsyncData('door:sessions', () => door.sessions(), { default: () => [] })
}

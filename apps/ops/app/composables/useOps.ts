import { isApiError } from '@afriff/api'
import type { StaffMember } from '@afriff/api/door'
import type { OpsActionInput, OpsActionName, OpsActionOutput, OpsApi } from '@afriff/api/ops'

/** The Ops API. Pages use this rather than importing an adapter. */
export function useOps(): OpsApi {
  return useNuxtApp().$ops
}

/** The staff member signed in on this device. Memory only: the adapter holds the session. */
export function useStaff() {
  const ops = useOps()
  const staff = useState<StaffMember | null>('ops:staff', () => null)
  const isAdmin = computed(() => staff.value?.role === 'admin')

  async function restore() {
    try {
      staff.value = await ops.auth.restore()
    }
    catch (error) {
      if (isApiError(error) && error.code === 'unauthorized') staff.value = null
    }
  }

  async function signIn(email: string, password: string) {
    staff.value = await ops.auth.signIn({ email, password })
  }

  async function signOut() {
    await ops.auth.signOut().catch(() => {})
    staff.value = null
    clearNuxtData()
    await navigateTo('/signin', { replace: true })
  }

  return { staff, isAdmin, restore, signIn, signOut }
}

/** The programme, loaded once and shared; refreshed after a change to it. */
export function useOpsProgramme() {
  const ops = useOps()
  return useAsyncData('ops:programme', () => ops.programme())
}

/**
 * Runs one Ops change with the state a form needs: pending while it runs, the
 * error beside the right field (or for the form), and a toast once it is done.
 */
export function useOpsAction<A extends OpsActionName>(action: A) {
  const ops = useOps()
  const toast = useToast()
  const pending = ref(false)
  const error = ref('')
  const field = ref('')

  async function run(input: OpsActionInput<A>, success?: string | ((output: OpsActionOutput<A>) => string)): Promise<OpsActionOutput<A> | null> {
    pending.value = true
    error.value = ''
    field.value = ''
    try {
      const output = await ops.act(action, input)
      if (success) toast.show(typeof success === 'function' ? success(output) : success)
      return output
    }
    catch (caught) {
      error.value = isApiError(caught) ? caught.message : 'That did not work. Try again.'
      field.value = isApiError(caught) ? String(caught.details?.field ?? '') : ''
      return null
    }
    finally {
      pending.value = false
    }
  }

  /** The error for one field, or '' when it belongs elsewhere. */
  const errorFor = (name: string) => (field.value === name ? error.value : '')
  /** The error when it names no field this form shows. */
  const formError = (fields: string[]) => (fields.includes(field.value) ? '' : error.value)

  return { run, pending, error, errorFor, formError }
}

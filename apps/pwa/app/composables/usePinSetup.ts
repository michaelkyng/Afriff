import { isApiError } from '@afriff/api'
import type { CodeChallenge, CodePurpose, VerificationTicket } from '@afriff/api'

export type PinSetupStep = 'email' | 'code' | 'pin'

type Field = 'email' | 'code' | 'firstName' | 'lastName' | 'pin' | 'confirm'

/**
 * The three-step flow behind both sign-up and "forgot PIN": confirm the email
 * with a one-time code, then choose the PIN that signs you in from here on.
 *
 * The two pages differ only in their wording and in whether a first and last
 * name are asked for, so they share this state machine and the `Auth*` step
 * components.
 */
export function usePinSetup(purpose: CodePurpose) {
  const auth = useAuth()

  const step = ref<PinSetupStep>('email')
  const form = reactive({ email: '', code: '', firstName: '', lastName: '', pin: '', confirm: '' })
  const errors = reactive<Record<Field, string>>({
    email: '',
    code: '',
    firstName: '',
    lastName: '',
    pin: '',
    confirm: '',
  })
  const challenge = ref<CodeChallenge | null>(null)
  const ticket = ref<VerificationTicket | null>(null)
  const pending = ref(false)

  /** Seconds until "Send again" is available. */
  const cooldown = ref(0)
  useIntervalFn(() => {
    if (cooldown.value > 0) cooldown.value -= 1
  }, 1000)

  function clearErrors() {
    for (const field of Object.keys(errors) as Field[]) errors[field] = ''
  }

  /** Shows an API error beside the field it names, or beside `fallbackField` when it names none. */
  function show(error: unknown, fallbackField: Field, fallbackMessage: string) {
    const named = isApiError(error) ? String(error.details?.field ?? '') : ''
    const field = (named in errors ? named : fallbackField) as Field
    errors[field] = isApiError(error) ? error.message : fallbackMessage
  }

  async function sendCode() {
    clearErrors()
    if (!form.email.trim()) {
      errors.email = 'Enter your email address.'
      return
    }
    pending.value = true
    try {
      challenge.value = await auth.requestCode(form.email, purpose)
      form.code = ''
      step.value = 'code'
      cooldown.value = 30
    }
    catch (error) {
      show(error, 'email', 'We could not send a code. Try again.')
    }
    finally {
      pending.value = false
    }
  }

  async function verifyCode() {
    clearErrors()
    const current = challenge.value
    if (!current) return
    pending.value = true
    try {
      ticket.value = await auth.verifyCode({ email: current.email, code: form.code })
      step.value = 'pin'
    }
    catch (error) {
      show(error, 'code', 'That did not work. Try again.')
    }
    finally {
      pending.value = false
    }
  }

  /** Resolves true once the PIN is set and the attendee is signed in. */
  async function savePin(): Promise<boolean> {
    clearErrors()
    const current = ticket.value
    if (!current) return false
    if (purpose === 'signup') {
      if (!form.firstName.trim()) errors.firstName = 'Enter your first name.'
      if (!form.lastName.trim()) errors.lastName = 'Enter your last name.'
      if (errors.firstName || errors.lastName) return false
    }
    if (!/^\d{6}$/.test(form.pin)) {
      errors.pin = 'Enter all six digits of your PIN.'
      return false
    }
    if (form.pin !== form.confirm) {
      errors.confirm = 'Both PINs need to be the same.'
      return false
    }
    pending.value = true
    try {
      await auth.setPin({
        ticket: current.token,
        pin: form.pin,
        firstName: purpose === 'signup' ? form.firstName : undefined,
        lastName: purpose === 'signup' ? form.lastName : undefined,
      })
      return true
    }
    catch (error) {
      show(error, 'pin', 'We could not save that PIN. Try again.')
      return false
    }
    finally {
      pending.value = false
    }
  }

  /** Back to step one, keeping the typed email so a typo is quick to correct. */
  function changeEmail() {
    clearErrors()
    challenge.value = null
    ticket.value = null
    form.code = ''
    step.value = 'email'
  }

  return { purpose, step, form, errors, challenge, ticket, pending, cooldown, sendCode, verifyCode, savePin, changeEmail }
}

export type PinSetup = ReturnType<typeof usePinSetup>

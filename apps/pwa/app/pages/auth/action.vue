<script setup lang="ts">
import { CircleCheckIcon } from 'lucide-vue-next'
import { isApiError } from '@afriff/api'

/**
 * Where the links in account emails land: `?mode=resetPassword` or
 * `?mode=verifyEmail`, with the link's `oobCode`. Firebase is pointed here by the
 * "action URL" in its email templates (see firebase/README.md), so the attendee
 * finishes in the app rather than on a Firebase page. Works signed out, since a
 * link is often opened on another device.
 */
definePageMeta({ layout: 'auth' })

const route = useRoute()
const auth = useAuth()

type Mode = 'resetPassword' | 'verifyEmail'
type State = 'checking' | 'ready' | 'done' | 'invalid'

const mode = computed<Mode | null>(() =>
  route.query.mode === 'resetPassword' || route.query.mode === 'verifyEmail' ? route.query.mode : null,
)
const code = computed(() => (typeof route.query.oobCode === 'string' ? route.query.oobCode : ''))

/** Where the email meant to send the attendee afterwards, if it is somewhere in this app. */
const next = computed(() => {
  const raw = route.query.continueUrl
  if (typeof raw === 'string' && URL.canParse(raw)) {
    const url = new URL(raw)
    if (url.origin === window.location.origin) return authRedirect(`${url.pathname}${url.search}`)
  }
  return authRedirect(route.query.redirect)
})

const state = ref<State>('checking')
const problem = ref('')
const email = ref('')

useHead({ title: () => (mode.value === 'verifyEmail' ? 'Confirm email' : 'Reset password') })

onMounted(async () => {
  if (!mode.value || !code.value) {
    problem.value = 'That link is not one we recognise. Open it from the email again.'
    state.value = 'invalid'
    return
  }
  try {
    if (mode.value === 'resetPassword') {
      email.value = (await auth.checkPasswordReset(code.value)).email
      state.value = 'ready'
    }
    else {
      await auth.verifyEmail(code.value)
      state.value = 'done'
    }
  }
  catch (error) {
    problem.value = isApiError(error) ? error.message : 'That link did not work. Ask for a new one.'
    state.value = 'invalid'
  }
})

// ---------------------------------------------------------------- new password

const password = ref('')
const { errors, clear, show } = useFieldErrors(['password'])
const saving = ref(false)

async function savePassword() {
  clear()
  if (password.value.length < 8) {
    errors.password = 'Use at least 8 characters.'
    return
  }
  saving.value = true
  try {
    await auth.resetPassword({ code: code.value, password: password.value })
    password.value = ''
    await navigateTo(next.value, { replace: true })
  }
  catch (error) {
    if (isApiError(error) && error.code === 'unauthorized') {
      problem.value = error.message
      state.value = 'invalid'
    }
    else show(error, 'password', 'We could not save that password. Try again.')
  }
  finally {
    saving.value = false
  }
}

// ---------------------------------------------------------------- a stale confirmation link

const resent = ref(false)
const resending = ref(false)

async function resendConfirmation() {
  resending.value = true
  try {
    await auth.sendEmailVerification()
    resent.value = true
  }
  catch (error) {
    problem.value = isApiError(error) ? error.message : 'We could not send a new link. Try again.'
  }
  finally {
    resending.value = false
  }
}

const title = computed(() => {
  if (state.value === 'invalid') return mode.value === 'verifyEmail' ? 'That link has run out' : 'That reset link has run out'
  if (mode.value === 'verifyEmail') return state.value === 'done' ? 'Email confirmed' : 'Confirming your email'
  return 'Choose a new password'
})
</script>

<template>
  <AuthPanel :title="title">
    <template #description>
      <template v-if="state === 'checking'">Checking your link.</template>
      <template v-else-if="state === 'ready'">
        For <span class="font-medium text-ink">{{ email }}</span>. Anywhere else you were signed in will be signed out.
      </template>
      <template v-else-if="state === 'done'">
        Thanks for checking. Your order confirmations, and the link if you ever forget your password, go here.
      </template>
      <template v-else>{{ problem }}</template>
    </template>

    <div v-if="state === 'checking'" class="space-y-3" aria-busy="true">
      <UiSkeleton class="h-4 w-1/3" />
      <UiSkeleton class="h-11 w-full rounded-tile" />
      <UiSkeleton class="h-10 w-full rounded-full" />
    </div>

    <form v-else-if="state === 'ready'" class="space-y-4" novalidate @submit.prevent="savePassword">
      <UiInput
        v-model="password"
        label="New password"
        type="password"
        autocomplete="new-password"
        reveal
        reveal-label="password"
        autofocus
        hint="At least 8 characters. A short phrase is easiest to remember."
        :error="errors.password"
        :disabled="saving"
      />
      <UiButton type="submit" block :loading="saving">{{ saving ? 'Saving' : 'Save and sign in' }}</UiButton>
    </form>

    <div v-else-if="state === 'done'" class="space-y-4">
      <p class="flex items-center gap-2.5 font-medium">
        <CircleCheckIcon class="size-5 text-success" aria-hidden="true" />
        Your email address is confirmed.
      </p>
      <UiButton block :to="auth.isSignedIn.value ? next : '/signin'">
        {{ auth.isSignedIn.value ? 'Continue' : 'Sign in' }}
      </UiButton>
    </div>

    <div v-else class="space-y-4">
      <template v-if="mode === 'verifyEmail' && auth.isSignedIn.value">
        <p v-if="resent" role="status" class="text-meta font-medium">A new link is on its way to {{ auth.user.value?.email }}.</p>
        <UiButton v-else block :loading="resending" @click="resendConfirmation">Send a new link</UiButton>
      </template>
      <UiButton v-else-if="mode === 'verifyEmail'" block to="/signin">Sign in to get a new link</UiButton>
      <UiButton v-else block to="/forgot-password">Get a new reset link</UiButton>
    </div>
  </AuthPanel>
</template>

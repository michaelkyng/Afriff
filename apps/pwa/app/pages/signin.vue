<script setup lang="ts">
import { isApiError } from '@afriff/api'

definePageMeta({ layout: 'auth' })
useHead({ title: 'Sign in' })

const auth = useAuth()
const { redirect, query } = useAuthRedirect()
const { data: festival } = useFestival()

const form = reactive({ email: '', pin: '' })
const errors = reactive({ email: '', pin: '' })
const pending = ref(false)

async function submit() {
  errors.email = ''
  errors.pin = ''
  if (!form.email.trim()) {
    errors.email = 'Enter your email address.'
    return
  }
  if (!/^\d{6}$/.test(form.pin)) {
    errors.pin = 'Enter your six-digit PIN.'
    return
  }
  pending.value = true
  try {
    await auth.signIn({ email: form.email, pin: form.pin })
    await navigateTo(redirect.value)
  }
  catch (error) {
    // A wrong pair is reported on the PIN; only a malformed email lands on the email.
    const field = isApiError(error) && error.details?.field === 'email' ? 'email' : 'pin'
    errors[field] = isApiError(error) ? error.message : 'We could not sign you in. Try again.'
  }
  finally {
    pending.value = false
  }
}

// Already signed in: nothing to do here.
watchEffect(() => {
  if (auth.isSignedIn.value) navigateTo(redirect.value, { replace: true })
})
</script>

<template>
  <div class="mx-auto flex w-full max-w-sm flex-col py-4 md:min-h-[calc(100dvh-14rem)] md:justify-center md:py-8">
    <div class="mb-6 md:mb-7">
      <BrandEmblem :size="44" class="mb-4" />
      <h1 class="font-display text-h1 font-semibold">Sign in to AFRIFF</h1>
      <p class="mt-1.5 text-muted">Your email and the six-digit PIN you chose.</p>
    </div>

    <UiCard>
      <form class="space-y-4" novalidate @submit.prevent="submit">
        <UiInput
          v-model="form.email"
          label="Email address"
          type="email"
          inputmode="email"
          autocomplete="email"
          placeholder="you@example.com"
          :error="errors.email"
          :disabled="pending"
        />

        <div>
          <UiPinInput
            v-model="form.pin"
            label="PIN"
            autocomplete="current-password"
            :error="errors.pin"
            :disabled="pending"
          />
          <div class="mt-2 text-right">
            <NuxtLink
              :to="{ path: '/reset-pin', query }"
              class="text-meta font-medium text-muted transition-colors hover:text-ink"
            >
              Forgot your PIN?
            </NuxtLink>
          </div>
        </div>

        <UiButton type="submit" block :loading="pending">{{ pending ? 'Signing in' : 'Sign in' }}</UiButton>
      </form>
    </UiCard>

    <p class="mt-5 text-center text-meta text-muted">
      New to AFRIFF?
      <NuxtLink
        :to="{ path: '/signup', query }"
        class="font-medium text-ink underline decoration-line-strong hover:decoration-current"
      >
        Create an account
      </NuxtLink>
    </p>

    <p class="mt-4 text-center text-meta text-muted">
      Sign in to access the programme, your festival plan and tickets.
      <template v-if="festival?.supportEmail">
        Stuck?
        <a
          :href="`mailto:${festival.supportEmail}`"
          class="font-medium text-ink underline decoration-line-strong hover:decoration-current"
        >{{ festival.supportEmail }}</a>
      </template>
    </p>
  </div>
</template>

<script setup lang="ts">
import { isApiError } from '@afriff/api'

useHead({ title: 'Sign in' })

const { signIn } = useStaff()
const demo = useRuntimeConfig().public.apiMode === 'mock'

const form = reactive({ email: '', password: '' })
const errors = reactive({ email: '', password: '' })
const pending = ref(false)

async function submit() {
  errors.email = ''
  errors.password = ''
  if (!form.email.trim()) errors.email = 'Enter your email address.'
  if (!form.password) errors.password = 'Enter your password.'
  if (errors.email || errors.password) return
  pending.value = true
  try {
    await signIn(form.email, form.password)
    await navigateTo('/', { replace: true })
  }
  catch (error) {
    const field = isApiError(error) && error.details?.field === 'email' ? 'email' : 'password'
    errors[field] = isApiError(error) ? error.message : 'We could not sign you in. Try again.'
  }
  finally {
    pending.value = false
  }
}

/** Mock mode: the demo door account, so the scanner can be tried at once. */
async function fillDemo() {
  const { MOCK_STAFF } = await import('@afriff/api/mock/door')
  form.email = MOCK_STAFF.email
  form.password = MOCK_STAFF.password
}
</script>

<template>
  <main id="main" class="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-4 py-10">
    <div class="mb-7">
      <BrandEmblem :size="48" class="mb-4" />
      <h1 class="font-display text-h1 font-semibold">AFRIFF Door</h1>
      <p class="mt-1.5 text-muted">For festival staff checking tickets in. Sign in with the account the festival team gave you.</p>
    </div>

    <UiCard>
      <form class="space-y-4" novalidate @submit.prevent="submit">
        <UiInput
          v-model="form.email"
          label="Email address"
          type="email"
          inputmode="email"
          autocomplete="username"
          :error="errors.email"
          :disabled="pending"
        />
        <UiInput
          v-model="form.password"
          label="Password"
          type="password"
          autocomplete="current-password"
          reveal
          reveal-label="password"
          :error="errors.password"
          :disabled="pending"
        />
        <UiButton type="submit" block size="lg" :loading="pending">{{ pending ? 'Signing in' : 'Sign in' }}</UiButton>
      </form>
    </UiCard>

    <div v-if="demo" class="mt-4 rounded-tile border border-line bg-raised px-3.5 py-3 text-meta">
      <p class="font-semibold">Demo mode</p>
      <p class="mt-1 text-pretty text-muted">The demo door has tickets of every kind to try. No real tickets are involved.</p>
      <UiButton variant="secondary" size="sm" class="mt-2.5" @click="fillDemo">Use the demo door account</UiButton>
    </div>

    <p class="mt-5 text-center text-meta text-pretty text-muted">
      Ticket holders do not need this app. Their tickets are in the AFRIFF app.
    </p>
  </main>
</template>

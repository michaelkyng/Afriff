<script setup lang="ts">
import { isApiError } from '@afriff/api'

definePageMeta({ layout: 'bare' })
useHead({ title: 'Sign in' })

const { signIn } = useStaff()
const route = useRoute()
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
    const redirect = typeof route.query.redirect === 'string' && route.query.redirect.startsWith('/') && !route.query.redirect.startsWith('//') ? route.query.redirect : '/'
    await navigateTo(redirect, { replace: true })
  }
  catch (error) {
    const field = isApiError(error) && error.details?.field === 'email' ? 'email' : 'password'
    errors[field] = isApiError(error) ? error.message : 'We could not sign you in. Try again.'
  }
  finally {
    pending.value = false
  }
}

async function fillDemo() {
  const { MOCK_OPS } = await import('@afriff/api/mock/ops')
  form.email = MOCK_OPS.email
  form.password = MOCK_OPS.password
}
</script>

<template>
  <div>
    <div class="mb-7">
      <BrandEmblem :size="48" class="mb-4" />
      <h1 class="font-display text-h1 font-semibold">AFRIFF Ops</h1>
      <p class="mt-1.5 text-muted">For the festival team. Sign in with your staff account.</p>
    </div>
    <UiCard>
      <form class="space-y-4" novalidate @submit.prevent="submit">
        <UiInput v-model="form.email" label="Email address" type="email" inputmode="email" autocomplete="username" :error="errors.email" :disabled="pending" />
        <UiInput v-model="form.password" label="Password" type="password" autocomplete="current-password" reveal reveal-label="password" :error="errors.password" :disabled="pending" />
        <UiButton type="submit" block :loading="pending">{{ pending ? 'Signing in' : 'Sign in' }}</UiButton>
      </form>
    </UiCard>
    <div v-if="demo" class="mt-4 rounded-tile border border-line bg-raised px-3.5 py-3 text-meta">
      <p class="font-semibold">Demo mode</p>
      <p class="mt-1 text-pretty text-muted">The demo console has made-up orders to work with. Nothing you change leaves this browser.</p>
      <UiButton variant="secondary" size="sm" class="mt-2.5" @click="fillDemo">Use the demo admin account</UiButton>
    </div>
  </div>
</template>

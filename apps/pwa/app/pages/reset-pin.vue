<script setup lang="ts">
definePageMeta({ layout: 'auth' })
useHead({ title: 'Reset PIN' })

const { redirect, query } = useAuthRedirect()
const flow = usePinSetup('reset')
const { step, form, errors, challenge, pending, sendCode } = flow

const title = computed(() => ({
  email: 'Reset your PIN',
  code: 'Check your inbox',
  pin: 'Choose a new PIN',
}[step.value]))
</script>

<template>
  <div class="mx-auto flex w-full max-w-sm flex-col py-4 md:min-h-[calc(100dvh-14rem)] md:justify-center md:py-8">
    <AppBackLink v-if="step === 'email'" fallback="/signin" label="Back" class="md:hidden" />
    <div class="mb-6 md:mb-7">
      <BrandEmblem :size="44" class="mb-4" />
      <h1 class="font-display text-h1 font-semibold">{{ title }}</h1>
      <p class="mt-1.5 text-muted">
        <template v-if="step === 'email'">
          We send a six-digit code to your email, then you can pick a new PIN.
        </template>
        <template v-else-if="step === 'code'">
          We sent a code to <span class="font-medium text-ink">{{ challenge?.email }}</span>.
        </template>
        <template v-else>
          Your old PIN stops working, and anywhere else you were signed in is signed out.
        </template>
      </p>
    </div>

    <UiCard>
      <!-- Step 1: email -->
      <form v-if="step === 'email'" class="space-y-4" novalidate @submit.prevent="sendCode()">
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
        <UiButton type="submit" block :loading="pending">{{ pending ? 'Sending' : 'Send code' }}</UiButton>
      </form>

      <!-- Step 2: the one-time code -->
      <AuthCodeStep v-else-if="step === 'code'" :flow="flow" />

      <!-- Step 3: the new PIN -->
      <AuthPinStep v-else :flow="flow" submit-label="Save PIN and sign in" @done="navigateTo(redirect)" />
    </UiCard>

    <p class="mt-5 text-center text-meta text-muted">
      Remembered it?
      <NuxtLink
        :to="{ path: '/signin', query }"
        class="font-medium text-ink underline decoration-line-strong hover:decoration-current"
      >
        Sign in
      </NuxtLink>
    </p>
  </div>
</template>

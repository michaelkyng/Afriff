<script setup lang="ts">
definePageMeta({ layout: 'auth' })
useHead({ title: 'Create account' })

const auth = useAuth()
const { redirect, query } = useAuthRedirect()
const flow = usePinSetup('signup')
const { step, form, errors, challenge, pending, sendCode } = flow

const title = computed(() => ({
  email: 'Create your AFRIFF account',
  code: 'Confirm your email',
  pin: 'Set your PIN',
}[step.value]))

// Already signed in: nothing to do here.
watchEffect(() => {
  if (auth.isSignedIn.value) navigateTo(redirect.value, { replace: true })
})
</script>

<template>
  <div class="mx-auto flex w-full max-w-sm flex-col py-4 md:min-h-[calc(100dvh-14rem)] md:justify-center md:py-8">
    <div class="mb-6 md:mb-7">
      <BrandEmblem :size="44" class="mb-4" />
      <h1 class="font-display text-h1 font-semibold">{{ title }}</h1>
      <p class="mt-1.5 text-muted">
        <template v-if="step === 'email'">
          We send a six-digit code to check the address, then you pick a PIN.
        </template>
        <template v-else-if="step === 'code'">
          We sent a code to <span class="font-medium text-ink">{{ challenge?.email }}</span>.
        </template>
        <template v-else>
          This is what signs you in from now on, along with your email.
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

      <!-- Step 3: name and PIN -->
      <AuthPinStep v-else :flow="flow" submit-label="Create account" @done="navigateTo(redirect)" />
    </UiCard>

    <p class="mt-5 text-center text-meta text-muted">
      Already have an account?
      <NuxtLink
        :to="{ path: '/signin', query }"
        class="font-medium text-ink underline decoration-line-strong hover:decoration-current"
      >
        Sign in
      </NuxtLink>
    </p>
  </div>
</template>

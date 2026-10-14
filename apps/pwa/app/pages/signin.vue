<script setup lang="ts">
definePageMeta({ layout: 'auth' })
useHead({ title: 'Sign in' })

const auth = useAuth()
const { redirect, query } = useAuthRedirect()
const { data: festival } = useFestival()

const email = useAuthEmail()
const password = ref('')
const { errors, clear, show } = useFieldErrors(['email', 'password'])
const pending = ref(false)

async function submit() {
  clear()
  if (!email.value.trim()) errors.email = 'Enter your email address.'
  if (!password.value) errors.password = 'Enter your password.'
  if (errors.email || errors.password) return
  pending.value = true
  try {
    await auth.signIn({ email: email.value, password: password.value })
    password.value = ''
    await navigateTo(redirect.value)
  }
  catch (error) {
    // A wrong pair is reported on the password; only a malformed email lands on the email.
    show(error, 'password', 'We could not sign you in. Try again.')
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
  <AuthPanel title="Sign in to AFRIFF" description="With the email and password you signed up with.">
    <form class="space-y-4" novalidate @submit.prevent="submit">
      <UiInput
        v-model="email"
        label="Email address"
        type="email"
        inputmode="email"
        autocomplete="email"
        placeholder="you@example.com"
        :error="errors.email"
        :disabled="pending"
      />

      <div>
        <UiInput
          v-model="password"
          label="Password"
          type="password"
          autocomplete="current-password"
          reveal
          reveal-label="password"
          :error="errors.password"
          :disabled="pending"
        />
        <div class="mt-2 text-right">
          <NuxtLink
            :to="{ path: '/forgot-password', query }"
            class="text-meta font-medium text-muted transition-colors hover:text-ink"
          >
            Forgot your password?
          </NuxtLink>
        </div>
      </div>

      <UiButton type="submit" block :loading="pending">{{ pending ? 'Signing in' : 'Sign in' }}</UiButton>
    </form>

    <template #after>
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
    </template>
  </AuthPanel>
</template>

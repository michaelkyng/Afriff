<script setup lang="ts">
definePageMeta({ layout: 'auth' })
useHead({ title: 'Create account' })

const auth = useAuth()
const { redirect, query } = useAuthRedirect()

const email = useAuthEmail()
const form = reactive({ firstName: '', lastName: '', password: '' })
const { errors, clear, show } = useFieldErrors(['firstName', 'lastName', 'email', 'password'])
const pending = ref(false)

async function submit() {
  clear()
  if (!form.firstName.trim()) errors.firstName = 'Enter your first name.'
  if (!form.lastName.trim()) errors.lastName = 'Enter your last name.'
  if (!email.value.trim()) errors.email = 'Enter your email address.'
  if (form.password.length < 8) errors.password = 'Use at least 8 characters.'
  if (Object.values(errors).some(Boolean)) return
  pending.value = true
  try {
    await auth.signUp({ email: email.value, password: form.password, firstName: form.firstName, lastName: form.lastName })
    form.password = ''
    await navigateTo(redirect.value)
  }
  catch (error) {
    show(error, 'email', 'We could not create your account. Try again.')
  }
  finally {
    pending.value = false
  }
}

// Already signed in: nothing to do here.
watchEffect(() => {
  if (auth.isSignedIn.value && !pending.value) navigateTo(redirect.value, { replace: true })
})
</script>

<template>
  <AuthPanel
    title="Create your AFRIFF account"
    description="For your tickets, your festival plan and updates about what you have booked."
  >
    <form class="space-y-4" novalidate @submit.prevent="submit">
      <div>
        <div class="grid grid-cols-2 gap-3">
          <UiInput
            v-model="form.firstName"
            label="First name"
            autocomplete="given-name"
            placeholder="Ada"
            autofocus
            :error="errors.firstName"
            :disabled="pending"
          />
          <UiInput
            v-model="form.lastName"
            label="Last name"
            autocomplete="family-name"
            placeholder="Okoye"
            :error="errors.lastName"
            :disabled="pending"
          />
        </div>
        <p class="mt-1.5 text-meta text-muted">This is the name on your tickets.</p>
      </div>

      <UiInput
        v-model="email"
        label="Email address"
        type="email"
        inputmode="email"
        autocomplete="email"
        placeholder="you@example.com"
        hint="We send a link to confirm it."
        :error="errors.email"
        :disabled="pending"
      />

      <UiInput
        v-model="form.password"
        label="Password"
        type="password"
        autocomplete="new-password"
        reveal
        reveal-label="password"
        hint="At least 8 characters. A short phrase is easiest to remember."
        :error="errors.password"
        :disabled="pending"
      />

      <UiButton type="submit" block :loading="pending">{{ pending ? 'Creating your account' : 'Create account' }}</UiButton>
    </form>

    <template #after>
      <p class="mt-5 text-center text-meta text-muted">
        Already have an account?
        <NuxtLink
          :to="{ path: '/signin', query }"
          class="font-medium text-ink underline decoration-line-strong hover:decoration-current"
        >
          Sign in
        </NuxtLink>
      </p>
    </template>
  </AuthPanel>
</template>

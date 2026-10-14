<script setup lang="ts">
import { ArrowLeftIcon } from 'lucide-vue-next'
import type { PasswordResetChallenge } from '@afriff/api'

definePageMeta({ layout: 'auth' })
useHead({ title: 'Reset password' })

const auth = useAuth()
const { query } = useAuthRedirect()

const email = useAuthEmail()
const { errors, clear, show } = useFieldErrors(['email'])
const pending = ref(false)
/** Set once a link is on its way; the screen then says where to look. */
const sent = ref<PasswordResetChallenge | null>(null)

/** Seconds until "Send again" is available. */
const cooldown = ref(0)
useIntervalFn(() => {
  if (cooldown.value > 0) cooldown.value -= 1
}, 1000)

async function send() {
  clear()
  if (!email.value.trim()) {
    errors.email = 'Enter your email address.'
    return
  }
  pending.value = true
  try {
    sent.value = await auth.requestPasswordReset(email.value)
    cooldown.value = 30
  }
  catch (error) {
    show(error, 'email', 'We could not send the link. Try again.')
  }
  finally {
    pending.value = false
  }
}

/** Mock mode: open the link the email would have carried. */
function openDemoLink() {
  if (!sent.value?.devCode) return
  navigateTo({ path: '/auth/action', query: { mode: 'resetPassword', oobCode: sent.value.devCode, ...query.value } })
}
</script>

<template>
  <AuthPanel :title="sent ? 'Check your inbox' : 'Reset your password'">
    <template #before>
      <AppBackLink v-if="!sent" fallback="/signin" label="Back" class="md:hidden" />
    </template>

    <template #description>
      <template v-if="sent">
        If there is an account for <span class="font-medium text-ink">{{ sent.email }}</span>, a link to choose a new
        password is on its way. It works for an hour.
      </template>
      <template v-else>
        We email you a link to choose a new one.
      </template>
    </template>

    <form v-if="!sent" class="space-y-4" novalidate @submit.prevent="send">
      <UiInput
        v-model="email"
        label="Email address"
        type="email"
        inputmode="email"
        autocomplete="email"
        placeholder="you@example.com"
        autofocus
        :error="errors.email"
        :disabled="pending"
      />
      <UiButton type="submit" block :loading="pending">{{ pending ? 'Sending' : 'Send reset link' }}</UiButton>
    </form>

    <div v-else class="space-y-4">
      <AuthDemoNotice v-if="sent.devCode" action-label="Open the reset link" @action="openDemoLink">
        In the real app this link arrives by email.
      </AuthDemoNotice>
      <p v-else class="text-meta text-pretty text-muted">
        Nothing after a few minutes? Check spam and promotions, or send it again.
      </p>

      <div class="flex items-center justify-between gap-3 text-meta">
        <button
          type="button"
          class="inline-flex items-center gap-1 font-medium text-muted transition-colors hover:text-ink"
          @click="sent = null"
        >
          <ArrowLeftIcon class="size-3.5" aria-hidden="true" />
          Another email
        </button>
        <button
          type="button"
          class="font-medium text-muted transition-colors hover:text-ink disabled:opacity-60 disabled:hover:text-muted"
          :disabled="cooldown > 0 || pending"
          @click="send"
        >
          {{ cooldown > 0 ? `Send again in ${cooldown}s` : 'Send again' }}
        </button>
      </div>
    </div>

    <template #after>
      <p class="mt-5 text-center text-meta text-muted">
        Remembered it?
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

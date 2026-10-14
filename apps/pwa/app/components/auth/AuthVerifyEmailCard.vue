<script setup lang="ts">
import { MailWarningIcon } from 'lucide-vue-next'
import { isApiError } from '@afriff/api'
import type { EmailVerificationChallenge } from '@afriff/api'

/**
 * Shown on Me until the attendee opens the link sent at sign-up. Nothing is held
 * back meanwhile; this is the nudge, with a way to get the link again.
 */
const auth = useAuth()

const sent = ref<EmailVerificationChallenge | null>(null)
const sending = ref(false)
const message = ref('')

/** Seconds until another link can be asked for. */
const cooldown = ref(0)
useIntervalFn(() => {
  if (cooldown.value > 0) cooldown.value -= 1
}, 1000)

async function send() {
  sending.value = true
  message.value = ''
  try {
    sent.value = await auth.sendEmailVerification()
    cooldown.value = 30
  }
  catch (error) {
    message.value = isApiError(error) ? error.message : 'We could not send the link. Try again.'
  }
  finally {
    sending.value = false
  }
}

/** Mock mode: open the link the email would have carried. */
async function confirmDemo() {
  if (!sent.value?.devCode) return
  try {
    await auth.verifyEmail(sent.value.devCode)
  }
  catch (error) {
    message.value = isApiError(error) ? error.message : 'That did not work. Send a new link.'
  }
}
</script>

<template>
  <UiCard class="space-y-3">
    <div class="flex items-start gap-3">
      <span class="grid size-9 shrink-0 place-items-center rounded-full bg-accent-soft text-accent-ink" aria-hidden="true">
        <MailWarningIcon class="size-4.5" />
      </span>
      <div class="min-w-0 flex-1">
        <p class="font-semibold">Confirm your email</p>
        <p class="text-meta text-pretty text-muted">
          <template v-if="sent">A new link is on its way to {{ sent.email }}. Check spam if it is not there in a few minutes.</template>
          <template v-else>
            We sent a link to {{ auth.user.value?.email }} when you signed up. Confirming it keeps your order emails
            and password resets coming to the right place.
          </template>
        </p>
      </div>
    </div>

    <AuthDemoNotice v-if="sent?.devCode" action-label="Confirm now" @action="confirmDemo">
      In the real app this link arrives by email.
    </AuthDemoNotice>

    <p v-if="message" role="alert" class="text-meta text-danger">{{ message }}</p>

    <UiButton size="sm" variant="secondary" :loading="sending" :disabled="cooldown > 0" @click="send">
      {{ cooldown > 0 ? `Send again in ${cooldown}s` : sent ? 'Send again' : 'Send a new link' }}
    </UiButton>
  </UiCard>
</template>

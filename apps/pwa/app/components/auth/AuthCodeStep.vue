<script setup lang="ts">
import { ArrowLeftIcon, MailCheckIcon } from 'lucide-vue-next'
import type { PinSetup } from '~/composables/usePinSetup'

/** Step two of sign-up and PIN reset: the one-time code sent to the email. */
const { flow } = defineProps<{ flow: PinSetup }>()

const { form, errors, challenge, pending, cooldown, sendCode, verifyCode, changeEmail } = flow

function fillDemoCode() {
  if (challenge.value?.devCode) form.code = challenge.value.devCode
}
</script>

<template>
  <form class="space-y-4" novalidate @submit.prevent="verifyCode()">
    <UiInput
      v-model="form.code"
      label="Six-digit code"
      inputmode="numeric"
      autocomplete="one-time-code"
      :maxlength="6"
      placeholder="000000"
      code
      autofocus
      :error="errors.code"
      :disabled="pending"
    />

    <div v-if="challenge?.devCode" class="rounded-tile border border-line bg-raised px-3.5 py-3">
      <p class="flex items-center gap-2 text-meta font-medium">
        <MailCheckIcon class="size-4 text-info" aria-hidden="true" />
        Demo mode: no email is sent
      </p>
      <p class="mt-1 text-meta text-muted">
        Your code is
        <span class="font-semibold text-ink tabular-nums">{{ challenge.devCode }}</span>, though any six digits will do
        until email is wired up.
      </p>
      <UiButton variant="secondary" size="sm" class="mt-2.5" @click="fillDemoCode">Fill it in</UiButton>
    </div>

    <UiButton type="submit" block :loading="pending">{{ pending ? 'Checking' : 'Continue' }}</UiButton>

    <div class="flex items-center justify-between gap-3 text-meta">
      <button
        type="button"
        class="inline-flex items-center gap-1 font-medium text-muted transition-colors hover:text-ink"
        @click="changeEmail()"
      >
        <ArrowLeftIcon class="size-3.5" aria-hidden="true" />
        Another email
      </button>
      <button
        type="button"
        class="font-medium text-muted transition-colors hover:text-ink disabled:opacity-60 disabled:hover:text-muted"
        :disabled="cooldown > 0 || pending"
        @click="sendCode()"
      >
        {{ cooldown > 0 ? `Send again in ${cooldown}s` : 'Send again' }}
      </button>
    </div>
  </form>
</template>

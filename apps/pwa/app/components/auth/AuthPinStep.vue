<script setup lang="ts">
import type { PinSetup } from '~/composables/usePinSetup'

/** Step three of sign-up and PIN reset: choose the PIN, and a name on the way in. */
const { flow } = defineProps<{ flow: PinSetup; submitLabel: string }>()

const emit = defineEmits<{ done: [] }>()

const { form, errors, pending, purpose, savePin } = flow

async function submit() {
  if (await savePin()) emit('done')
}
</script>

<template>
  <form class="space-y-4" novalidate @submit.prevent="submit">
    <UiInput
      v-if="purpose === 'signup'"
      v-model="form.name"
      label="Your name"
      autocomplete="name"
      placeholder="Ada Okoye"
      hint="This is the name on your tickets."
      autofocus
      :error="errors.name"
      :disabled="pending"
    />

    <UiInput
      v-model="form.pin"
      label="Choose a PIN"
      type="password"
      inputmode="numeric"
      autocomplete="new-password"
      :maxlength="6"
      placeholder="••••••"
      code
      reveal
      reveal-label="PIN"
      :autofocus="purpose === 'reset'"
      hint="Six digits. You will use it every time you sign in."
      :error="errors.pin"
      :disabled="pending"
    />

    <UiInput
      v-model="form.confirm"
      label="Confirm PIN"
      type="password"
      inputmode="numeric"
      autocomplete="new-password"
      :maxlength="6"
      placeholder="••••••"
      code
      reveal
      reveal-label="confirmation"
      :error="errors.confirm"
      :disabled="pending"
    />

    <UiButton type="submit" block :loading="pending">{{ pending ? 'Saving' : submitLabel }}</UiButton>
  </form>
</template>

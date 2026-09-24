<script setup lang="ts">
import type { PinSetup } from '~/composables/usePinSetup'

/** Step three of sign-up and PIN reset: choose the PIN, and a first and last name on the way in. */
const { flow } = defineProps<{ flow: PinSetup; submitLabel: string }>()

const emit = defineEmits<{ done: [] }>()

const { form, errors, pending, purpose, savePin } = flow

async function submit() {
  if (await savePin()) emit('done')
}
</script>

<template>
  <form class="space-y-4" novalidate @submit.prevent="submit">
    <div v-if="purpose === 'signup'">
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

    <UiPinInput
      v-model="form.pin"
      label="Choose a PIN"
      autocomplete="new-password"
      :autofocus="purpose === 'reset'"
      :error="errors.pin"
      :disabled="pending"
    />

    <UiPinInput
      v-model="form.confirm"
      label="Confirm PIN"
      autocomplete="new-password"
      reveal-label="confirmation"
      :error="errors.confirm"
      :disabled="pending"
    />

    <UiButton type="submit" block :loading="pending">{{ pending ? 'Saving' : submitLabel }}</UiButton>
  </form>
</template>

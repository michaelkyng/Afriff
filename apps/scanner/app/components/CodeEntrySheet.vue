<script setup lang="ts">
import { parseScan } from '@afriff/api/door'

/** For a ticket the camera will not read: a cracked screen, a printout in the rain. */
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ submit: [code: string] }>()

const code = ref('')
const error = ref('')

/** Shapes what is typed into AF-XXXX-XXXX as it goes, so it is easy to check against the ticket. */
watch(code, (value) => {
  const characters = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10)
  const shaped = [characters.slice(0, 2), characters.slice(2, 6), characters.slice(6)].filter(Boolean).join('-')
  if (shaped !== value) code.value = shaped
  error.value = ''
})

watch(open, (value) => {
  if (value) code.value = ''
})

function submit() {
  if (!parseScan(code.value)) {
    error.value = 'That is not a ticket code. They look like AF-7KQ2-P4NR.'
    return
  }
  emit('submit', code.value)
  open.value = false
}
</script>

<template>
  <UiSheet v-model:open="open" title="Type the code">
    <form class="space-y-4" novalidate @submit.prevent="submit">
      <UiInput
        v-model="code"
        label="Ticket code"
        placeholder="AF-7KQ2-P4NR"
        autocomplete="off"
        :maxlength="12"
        code
        autofocus
        hint="Printed under the QR code on the ticket."
        :error="error"
      />
      <UiButton type="submit" block size="lg">Check ticket</UiButton>
    </form>
  </UiSheet>
</template>

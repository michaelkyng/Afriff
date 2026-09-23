<script setup lang="ts">
import { isApiError } from '@afriff/api'
import type { Ticket } from '@afriff/api'

/**
 * Passes a ticket to someone else. It cannot be undone, so the sheet says so
 * plainly and asks for the address twice over: once typed, once read back.
 */
const props = defineProps<{ ticket: Ticket }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ transferred: [Ticket] }>()

const api = useApi()

const email = ref('')
const name = ref('')
const errors = reactive<Record<string, string>>({})
const message = ref('')
const sending = ref(false)
const confirming = ref(false)

watch(open, (isOpen) => {
  if (!isOpen) return
  email.value = ''
  name.value = ''
  message.value = ''
  confirming.value = false
  Object.keys(errors).forEach((key) => delete errors[key])
})

async function send() {
  if (!confirming.value) {
    if (!email.value.trim()) {
      errors.email = 'Enter the address to send it to.'
      return
    }
    confirming.value = true
    return
  }

  Object.keys(errors).forEach((key) => delete errors[key])
  message.value = ''
  sending.value = true
  try {
    const updated = await api.tickets.transfer(props.ticket.id, { email: email.value, name: name.value })
    open.value = false
    emit('transferred', updated)
  }
  catch (error) {
    confirming.value = false
    const field = isApiError(error) ? String(error.details?.field ?? '') : ''
    const text = isApiError(error) ? error.message : 'We could not pass that ticket on. Try again.'
    if (field === 'email' || field === 'name') errors[field] = text
    else message.value = text
  }
  finally {
    sending.value = false
  }
}
</script>

<template>
  <UiSheet v-model:open="open" title="Pass this ticket on">
    <div class="space-y-5">
      <div class="rounded-tile border border-line bg-raised px-3.5 py-3">
        <p class="font-medium">{{ ticket.title }}</p>
        <p v-if="ticket.subtitle" class="mt-0.5 text-meta text-muted tabular-nums">{{ ticket.subtitle }}</p>
      </div>

      <UiInput
        v-model="email"
        label="Their email"
        type="email"
        inputmode="email"
        autocomplete="off"
        hint="They get a ticket with its own code. Yours stops working."
        :error="errors.email"
        :disabled="sending || confirming"
      />
      <UiInput
        v-model="name"
        label="Their name"
        autocomplete="off"
        hint="Optional. It goes on the ticket for the door."
        :error="errors.name"
        :disabled="sending || confirming"
      />

      <p v-if="confirming" role="alert" class="rounded-tile border border-line bg-raised px-3.5 py-3 text-meta">
        Sending this to <span class="font-semibold text-ink">{{ email }}</span>. This cannot be undone, and you
        will not be able to get the ticket back yourself.
      </p>

      <p v-if="message" role="alert" class="text-meta text-danger">{{ message }}</p>
    </div>

    <template #footer>
      <div class="flex items-center justify-between gap-3">
        <UiButton variant="ghost" :disabled="sending" @click="confirming ? (confirming = false) : (open = false)">
          {{ confirming ? 'Back' : 'Cancel' }}
        </UiButton>
        <UiButton :loading="sending" @click="send">
          {{ confirming ? 'Yes, send it' : 'Continue' }}
        </UiButton>
      </div>
    </template>
  </UiSheet>
</template>

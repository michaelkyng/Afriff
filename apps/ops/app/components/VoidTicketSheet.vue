<script setup lang="ts">
import type { OpsTicket } from '@afriff/api/ops'

/** Voiding stops a ticket admitting anyone. The reason is shown to the holder, on the ticket. */
const props = defineProps<{ ticket: OpsTicket | null }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ done: [] }>()

const reason = ref('')
const refund = ref(false)
const { run, pending, errorFor, formError } = useOpsAction('voidTicket')

watch(open, (value) => {
  if (value) {
    reason.value = ''
    refund.value = false
  }
})

async function submit() {
  if (!props.ticket) return
  if (await run({ ticketId: props.ticket.id, reason: reason.value, refund: refund.value }, `Voided ${props.ticket.code}.`)) {
    open.value = false
    emit('done')
  }
}
</script>

<template>
  <UiSheet v-model:open="open" :title="`Void ${ticket?.code ?? 'ticket'}`">
    <form v-if="ticket" class="space-y-4" novalidate @submit.prevent="submit">
      <p class="text-meta text-pretty text-muted">
        {{ ticket.holderName }}’s ticket for {{ ticket.title }} stops working at once, on their phone and at the door.
      </p>
      <UiTextarea v-model="reason" label="Reason, shown to the holder" :rows="2" :maxlength="200" placeholder="Bought twice by mistake. We will refund this one." :error="errorFor('reason')" :disabled="pending" />
      <UiCheckbox v-model="refund" label="Refund it" hint="Lists the order under Refunds due." :disabled="pending" />
      <p v-if="formError(['reason'])" role="alert" class="text-meta text-danger">{{ formError(['reason']) }}</p>
      <UiButton type="submit" variant="danger" block :loading="pending">Void ticket</UiButton>
    </form>
  </UiSheet>
</template>

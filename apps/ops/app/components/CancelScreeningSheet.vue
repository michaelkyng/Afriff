<script setup lang="ts">
import type { ScreeningChange } from '@afriff/api/ops'
import type { Screening } from '@afriff/api/types'

/** Cancelling is not undone with a button, so it asks for a reason and a deliberate tick. */
const props = defineProps<{ screening: Screening; title: string; tickets: number }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ cancelled: [change: ScreeningChange] }>()

const reason = ref('')
const understood = ref(false)
const { run, pending, error } = useOpsAction('cancelScreening')

watch(open, (value) => {
  if (value) {
    reason.value = ''
    understood.value = false
  }
})

async function submit() {
  const change = await run({ screeningId: props.screening.id, reason: reason.value || undefined },
    (output) => `Cancelled. ${output.ticketsAffected === 1 ? '1 ticket' : `${output.ticketsAffected} tickets`} voided, ${output.ordersFlagged === 1 ? '1 order' : `${output.ordersFlagged} orders`} to refund.`)
  if (!change) return
  open.value = false
  emit('cancelled', change)
}
</script>

<template>
  <UiSheet v-model:open="open" :title="`Cancel ${title}`">
    <form class="space-y-4" novalidate @submit.prevent="submit">
      <div class="rounded-tile border border-danger/40 bg-danger-soft px-3.5 py-3 text-meta">
        <p class="font-semibold text-danger">This cannot be undone here</p>
        <p class="mt-1 text-pretty">
          The screening stops selling and the door will not admit anyone to it. {{ tickets }} single
          {{ tickets === 1 ? 'ticket is' : 'tickets are' }} voided, with the reason shown on each, and their orders are listed under
          Refunds due. Passes are not affected.
        </p>
      </div>
      <UiTextarea v-model="reason" label="Reason, for the activity log" :rows="2" :maxlength="200" placeholder="Print did not arrive" :disabled="pending" />
      <UiCheckbox v-model="understood" label="I understand, cancel it" :disabled="pending" />
      <p v-if="error" role="alert" class="text-meta text-danger">{{ error }}</p>
      <UiButton type="submit" variant="danger" block :disabled="!understood" :loading="pending">Cancel screening</UiButton>
    </form>
  </UiSheet>
</template>

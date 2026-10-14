<script setup lang="ts">
import type { OpsOrder } from '@afriff/api/ops'

/** Refunds are made in Paystack's dashboard; this records that one was, and how. */
const props = defineProps<{ order: OpsOrder }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ done: [] }>()

const note = ref('')
const { run, pending, errorFor, formError } = useOpsAction('markRefunded')

watch(open, (value) => {
  if (value) note.value = ''
})

async function submit() {
  if (await run({ orderId: props.order.id, note: note.value }, `${props.order.reference} marked refunded.`)) {
    open.value = false
    emit('done')
  }
}
</script>

<template>
  <UiSheet v-model:open="open" :title="`Refund ${order.reference}`">
    <form class="space-y-4" novalidate @submit.prevent="submit">
      <ol class="list-decimal space-y-1.5 pl-5 text-meta text-pretty">
        <li>In the Paystack dashboard, find the transaction <span class="font-semibold tabular-nums">{{ order.payment.reference }}</span><template v-for="reference in order.duplicatePayments ?? []" :key="reference">, or the second payment <span class="font-semibold tabular-nums">{{ reference }}</span></template>.</li>
        <li>Refund {{ formatMoney(order.total) }}{{ order.duplicatePayments?.length ? ' for each duplicate' : '' }}.</li>
        <li>Note the refund here, so the order leaves the list.</li>
      </ol>
      <UiTextarea v-model="note" label="Note" :rows="3" :maxlength="300" placeholder="Refunded in Paystack, refund RF-5521" :error="errorFor('note')" :disabled="pending" />
      <p v-if="formError(['note'])" role="alert" class="text-meta text-danger">{{ formError(['note']) }}</p>
      <UiButton type="submit" block :loading="pending">Mark refunded</UiButton>
    </form>
  </UiSheet>
</template>

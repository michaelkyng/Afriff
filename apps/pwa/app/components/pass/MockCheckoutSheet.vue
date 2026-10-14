<script setup lang="ts">
import { CreditCardIcon } from 'lucide-vue-next'

/**
 * Mock mode's stand-in for Paystack's checkout. The attendee chooses how the
 * payment goes; closing the sheet is walking away from it, which leaves the
 * order waiting, as with the real thing.
 */
const { mockCheckout, finishMock } = usePayment()

const intent = computed(() => mockCheckout.value?.intent)
const open = computed({
  get: () => Boolean(mockCheckout.value),
  set: (value) => {
    if (!value) finishMock(null)
  },
})
</script>

<template>
  <UiSheet v-model:open="open" title="Test checkout">
    <div v-if="intent" class="space-y-5">
      <div>
        <p class="text-meta text-muted">Paying AFRIFF</p>
        <p class="font-display text-display font-semibold tabular-nums">{{ formatMoney(intent.amount) }}</p>
        <p class="mt-1 truncate text-meta text-muted">{{ intent.email }} · <span class="tabular-nums">{{ intent.reference }}</span></p>
      </div>

      <div class="rounded-tile border border-line bg-raised px-3.5 py-3 text-meta">
        <p class="font-semibold">Demo mode: no money moves</p>
        <p class="mt-1 text-pretty text-muted">
          This stands in for Paystack’s checkout in the local build. Choose how the payment goes. Closing it instead
          leaves your order waiting, with the tickets held.
        </p>
      </div>
    </div>

    <template #footer>
      <div v-if="intent" class="flex flex-col gap-2">
        <UiButton block size="lg" @click="finishMock('success')">
          <CreditCardIcon aria-hidden="true" />
          Pay {{ formatMoney(intent.amount) }}
        </UiButton>
        <UiButton block variant="ghost" @click="finishMock('failed')">Decline the payment</UiButton>
      </div>
    </template>
  </UiSheet>
</template>

<script setup lang="ts">
import { BanknoteIcon, CreditCardIcon } from 'lucide-vue-next'

/** Card or transfer, with the demo rules spelled out. Used by checkout and by a retry. */
export interface PaymentDraft {
  method: 'card' | 'transfer'
  cardName: string
  cardNumber: string
  expiry: string
  cvv: string
}

defineProps<{ errors?: Partial<Record<keyof PaymentDraft, string>>; disabled?: boolean }>()
const draft = defineModel<PaymentDraft>({ required: true })

const methods = [
  { value: 'card' as const, label: 'Card', icon: CreditCardIcon },
  { value: 'transfer' as const, label: 'Transfer', icon: BanknoteIcon },
]
</script>

<template>
  <div class="space-y-4">
    <UiSegmented v-model="draft.method" :options="methods" label="Payment method" />

    <template v-if="draft.method === 'card'">
      <UiInput
        v-model="draft.cardName"
        label="Name on card"
        autocomplete="cc-name"
        :error="errors?.cardName"
        :disabled="disabled"
      />
      <UiInput
        v-model="draft.cardNumber"
        label="Card number"
        inputmode="numeric"
        autocomplete="cc-number"
        placeholder="4111 1111 1111 1111"
        :error="errors?.cardNumber"
        :disabled="disabled"
      />
      <div class="grid grid-cols-2 gap-3">
        <UiInput
          v-model="draft.expiry"
          label="Expiry"
          inputmode="numeric"
          autocomplete="cc-exp"
          placeholder="11/29"
          :maxlength="5"
          :error="errors?.expiry"
          :disabled="disabled"
        />
        <UiInput
          v-model="draft.cvv"
          label="CVV"
          inputmode="numeric"
          autocomplete="cc-csc"
          placeholder="123"
          :maxlength="4"
          :error="errors?.cvv"
          :disabled="disabled"
        />
      </div>
      <div class="rounded-tile border border-line bg-raised px-3.5 py-3 text-meta">
        <p class="font-semibold">Demo mode: no money moves</p>
        <p class="mt-1 text-muted">
          Any card works. A number ending
          <span class="font-semibold text-ink tabular-nums">0000</span> is declined, and one ending
          <span class="font-semibold text-ink tabular-nums">0001</span> stays pending.
        </p>
      </div>
    </template>

    <div v-else class="rounded-tile border border-line bg-raised px-3.5 py-3 text-meta">
      <p class="font-semibold">Bank transfer</p>
      <p class="mt-1 text-muted">
        We show the account details and your reference on the next screen. Your tickets arrive once the
        transfer is confirmed.
      </p>
    </div>
  </div>
</template>

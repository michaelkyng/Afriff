<script setup lang="ts">
import { ArrowLeftRightIcon, CreditCardIcon, LandmarkIcon, ShieldCheckIcon, SmartphoneIcon } from 'lucide-vue-next'
import { ORDER_HOLD_MINUTES } from '@afriff/api/orders'

/** What happens at "Pay": who takes the money, the ways to pay, and how long the tickets are held. */
defineProps<{ demo?: boolean }>()

const methods = [
  { label: 'Card', icon: CreditCardIcon },
  { label: 'Bank transfer', icon: ArrowLeftRightIcon },
  { label: 'USSD', icon: SmartphoneIcon },
  { label: 'Bank account', icon: LandmarkIcon },
]
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-start gap-3">
      <span class="grid size-9 shrink-0 place-items-center rounded-full bg-accent-soft text-accent-ink" aria-hidden="true">
        <ShieldCheckIcon class="size-4.5" />
      </span>
      <div class="min-w-0">
        <p class="font-semibold">Pay securely with Paystack</p>
        <p class="text-meta text-pretty text-muted">Your card and bank details go straight to Paystack. AFRIFF never sees them.</p>
      </div>
    </div>

    <ul class="flex flex-wrap gap-1.5" aria-label="Ways to pay">
      <li
        v-for="method in methods"
        :key="method.label"
        class="inline-flex items-center gap-1.5 rounded-tag border border-line bg-raised px-2 py-1 text-label"
      >
        <component :is="method.icon" class="size-3.5 text-subtle" aria-hidden="true" />
        {{ method.label }}
      </li>
    </ul>

    <p class="text-meta text-muted">Your tickets are held for {{ ORDER_HOLD_MINUTES }} minutes while you pay.</p>

    <div v-if="demo" class="rounded-tile border border-line bg-raised px-3.5 py-3 text-meta">
      <p class="font-semibold">Demo mode: no money moves</p>
      <p class="mt-1 text-pretty text-muted">A test checkout stands in for Paystack, and you choose how the payment goes.</p>
    </div>
  </div>
</template>

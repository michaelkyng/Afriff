<script setup lang="ts">
import type { Money } from '@afriff/api'

/** Lines and total, shared by the cart, checkout and the order page. */
defineProps<{
  lines: { key?: string; id?: string; title: string; detail?: string; quantity: number; unitPrice: Money }[]
  total: Money
  title?: string
}>()
</script>

<template>
  <UiCard :padded="false">
    <h2 v-if="title" class="border-b border-line px-4 py-3 font-semibold md:px-5">{{ title }}</h2>
    <ul class="divide-y divide-line">
      <li v-for="line in lines" :key="line.key ?? line.id" class="flex gap-4 px-4 py-3 md:px-5">
        <span class="min-w-0 flex-1">
          <span class="block truncate font-semibold">{{ line.title }}</span>
          <span class="block text-label text-pretty text-muted tabular-nums">
            <template v-if="line.detail">{{ line.detail }} · </template>{{ line.quantity }} ×
            {{ formatMoney(line.unitPrice) }}
          </span>
        </span>
        <span class="shrink-0 font-medium tabular-nums">
          {{ formatMoney({ amount: line.unitPrice.amount * line.quantity, currency: 'NGN' }) }}
        </span>
      </li>
    </ul>
    <div class="flex items-center justify-between gap-4 border-t border-line px-4 py-3.5 md:px-5">
      <span class="font-semibold">Total</span>
      <span class="font-display text-h3 font-semibold tabular-nums">{{ formatMoney(total) }}</span>
    </div>
  </UiCard>
</template>

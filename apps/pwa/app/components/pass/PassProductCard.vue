<script setup lang="ts">
import { CheckIcon } from 'lucide-vue-next'
import type { TicketProduct } from '@afriff/api'

/** One product in the catalogue. Choosing opens the options sheet. */
defineProps<{ product: TicketProduct; inCart?: number }>()
defineEmits<{ choose: [] }>()
</script>

<template>
  <article class="card flex h-full flex-col p-4 md:p-5">
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <h3 class="text-h3 font-semibold">{{ product.name }}</h3>
        <p class="mt-0.5 text-meta text-muted">{{ product.summary }}</p>
      </div>
      <UiBadge v-if="product.badge" tone="accent">{{ product.badge }}</UiBadge>
    </div>

    <p class="mt-4 font-display text-h2 font-semibold tabular-nums">{{ formatMoney(product.price) }}</p>

    <ul class="mt-3 space-y-1.5 text-meta text-muted">
      <li v-for="perk in product.perks" :key="perk" class="flex gap-2">
        <CheckIcon class="mt-0.5 size-3.5 shrink-0 text-success" aria-hidden="true" />
        {{ perk }}
      </li>
    </ul>

    <div class="mt-auto flex items-center justify-between gap-3 pt-5">
      <p class="text-meta text-muted tabular-nums">
        <template v-if="product.remaining === 0">Sold out</template>
        <template v-else-if="product.remaining !== null && product.remaining <= 25">
          {{ product.remaining }} left
        </template>
        <template v-else-if="inCart">{{ inCart }} in cart</template>
      </p>
      <UiButton size="sm" :disabled="product.remaining === 0" @click="$emit('choose')">
        {{ product.remaining === 0 ? 'Sold out' : 'Choose' }}
      </UiButton>
    </div>
  </article>
</template>

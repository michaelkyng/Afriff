<script setup lang="ts">
import { Trash2Icon } from 'lucide-vue-next'
import type { CartLine } from '~/stores/cart'

defineProps<{ line: CartLine; max: number }>()
const emit = defineEmits<{ quantity: [number]; remove: [] }>()
</script>

<template>
  <div class="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3.5 md:px-5">
    <div class="min-w-0 flex-1 basis-48">
      <p class="truncate font-semibold">{{ line.title }}</p>
      <p class="truncate text-label text-muted tabular-nums">
        {{ line.productName }}<template v-if="line.detail"> · {{ line.detail }}</template>
      </p>
    </div>
    <UiStepper
      :model-value="line.quantity"
      label="ticket"
      :max="max"
      @update:model-value="emit('quantity', $event)"
    />
    <p class="w-24 text-right font-semibold tabular-nums">
      {{ formatMoney({ amount: line.unitPrice.amount * line.quantity, currency: 'NGN' }) }}
    </p>
    <button
      type="button"
      class="pressable grid size-9 place-items-center rounded-full text-muted hover:bg-hover hover:text-danger"
      :aria-label="`Remove ${line.title}`"
      @click="emit('remove')"
    >
      <Trash2Icon class="size-4" />
    </button>
  </div>
</template>

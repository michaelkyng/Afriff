<script setup lang="ts">
import { MinusIcon, PlusIcon } from 'lucide-vue-next'

/** Quantity control: minus, the number, plus. */
const props = withDefaults(defineProps<{ label: string; min?: number; max?: number }>(), { min: 1, max: 10 })
const model = defineModel<number>({ default: 1 })

const step = (by: number) => {
  model.value = Math.min(props.max, Math.max(props.min, model.value + by))
}
</script>

<template>
  <div class="inline-flex items-center gap-1 rounded-full border border-line bg-surface p-1 shadow-card">
    <button
      type="button"
      class="pressable grid size-8 place-items-center rounded-full text-ink hover:bg-hover disabled:opacity-40"
      :disabled="model <= min"
      :aria-label="`One fewer ${label}`"
      @click="step(-1)"
    >
      <MinusIcon class="size-4" />
    </button>
    <span class="min-w-6 text-center font-semibold tabular-nums" aria-live="polite" :aria-label="`${model} ${label}`">
      {{ model }}
    </span>
    <button
      type="button"
      class="pressable grid size-8 place-items-center rounded-full text-ink hover:bg-hover disabled:opacity-40"
      :disabled="model >= max"
      :aria-label="`One more ${label}`"
      @click="step(1)"
    >
      <PlusIcon class="size-4" />
    </button>
  </div>
</template>

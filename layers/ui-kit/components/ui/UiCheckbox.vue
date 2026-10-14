<script setup lang="ts">
import { useId } from 'vue'

/** A checkbox with a label and an optional line under it. The whole row is the hit area. */
defineProps<{ label: string; hint?: string; disabled?: boolean }>()
const model = defineModel<boolean>({ default: false })
const id = useId()
</script>

<template>
  <label :for="id" class="flex cursor-pointer items-start gap-3" :class="disabled && 'cursor-not-allowed opacity-60'">
    <input
      :id="id"
      v-model="model"
      type="checkbox"
      :disabled="disabled"
      :aria-describedby="hint ? `${id}-hint` : undefined"
      class="mt-0.5 size-5 shrink-0 rounded-[6px] border-line accent-[var(--c-accent)]"
    >
    <span class="min-w-0">
      <span class="block text-body font-medium">{{ label }}</span>
      <span v-if="hint" :id="`${id}-hint`" class="block text-meta text-muted">{{ hint }}</span>
    </span>
  </label>
</template>

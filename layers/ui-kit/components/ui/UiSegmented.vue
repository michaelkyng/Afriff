<script setup lang="ts" generic="T extends string">
import type { Component } from 'vue'

defineProps<{
  options: { value: T; label: string; icon?: Component }[]
  label: string
}>()

const model = defineModel<T>({ required: true })
</script>

<template>
  <div role="radiogroup" :aria-label="label" class="inline-flex rounded-full bg-raised p-0.5">
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      role="radio"
      :aria-checked="model === option.value"
      class="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-meta font-medium transition-[background-color,color,box-shadow] duration-200 ease-out [&_svg]:size-4"
      :class="
        model === option.value
          ? 'bg-surface text-ink shadow-[0_1px_2px_rgb(2_4_20/0.12),0_0_0_1px_var(--c-line)]'
          : 'text-muted hover:text-ink'
      "
      @click="model = option.value"
    >
      <component :is="option.icon" v-if="option.icon" aria-hidden="true" />
      {{ option.label }}
    </button>
  </div>
</template>

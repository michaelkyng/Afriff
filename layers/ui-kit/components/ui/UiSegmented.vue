<script setup lang="ts" generic="T extends string">
import type { Component } from 'vue'

defineProps<{
  options: { value: T; label: string; icon?: Component }[]
  label: string
}>()

const model = defineModel<T>({ required: true })
</script>

<template>
  <div role="radiogroup" :aria-label="label" class="inline-flex rounded-full border border-line bg-raised p-1">
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      role="radio"
      :aria-checked="model === option.value"
      class="inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium transition-colors [&_svg]:size-4"
      :class="model === option.value ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'"
      @click="model = option.value"
    >
      <component :is="option.icon" v-if="option.icon" aria-hidden="true" />
      {{ option.label }}
    </button>
  </div>
</template>

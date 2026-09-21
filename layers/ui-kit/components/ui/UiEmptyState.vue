<script setup lang="ts">
import type { Component } from 'vue'

defineProps<{
  icon?: Component
  title: string
  description?: string
}>()
</script>

<template>
  <div class="flex flex-col items-center px-6 py-14 text-center">
    <div
      v-if="icon"
      class="mb-5 grid size-14 place-items-center rounded-2xl bg-accent-soft text-accent-ink"
      aria-hidden="true"
    >
      <component :is="icon" class="size-6" />
    </div>
    <h2 class="font-display text-2xl font-semibold tracking-tight">{{ title }}</h2>
    <p v-if="description" class="mt-2 max-w-sm text-pretty text-muted">{{ description }}</p>
    <div v-if="$slots.default" class="mt-6 flex flex-wrap justify-center gap-3">
      <slot />
    </div>
  </div>
</template>

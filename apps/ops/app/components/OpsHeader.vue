<script setup lang="ts">
/** A page title with a line under it and room for actions on the right. */
defineProps<{ title: string; description?: string }>()
</script>

<template>
  <header class="mb-6 flex flex-wrap items-end justify-between gap-4">
    <div class="min-w-0">
      <slot name="before" />
      <h1 class="font-display text-h1 font-semibold text-balance">{{ title }}</h1>
      <p v-if="description || $slots.description" class="mt-1 text-pretty text-muted"><slot name="description">{{ description }}</slot></p>
    </div>
    <div v-if="$slots.default" class="flex flex-wrap gap-2"><slot /></div>
  </header>
</template>

<script setup lang="ts">
/** Page title block. One title size everywhere; actions sit to the right on wide screens. */
defineProps<{ title: string; description?: string }>()
</script>

<template>
  <header class="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
    <div class="min-w-0">
      <h1 class="font-display text-h1 font-semibold">{{ title }}</h1>
      <p v-if="description" class="mt-1 max-w-xl text-muted">{{ description }}</p>
    </div>
    <div v-if="$slots.actions" class="flex items-center gap-2">
      <slot name="actions" />
    </div>
  </header>
</template>

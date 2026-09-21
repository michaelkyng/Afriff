<script setup lang="ts">
/** Page title block. Large on phones (like native large titles), app-sized on desktop. */
defineProps<{ title: string; eyebrow?: string; description?: string }>()
</script>

<template>
  <header class="flex flex-wrap items-end justify-between gap-4">
    <div class="min-w-0">
      <p v-if="eyebrow" class="text-xs font-semibold tracking-[0.14em] text-accent-ink uppercase">{{ eyebrow }}</p>
      <h1 class="mt-1 font-display text-4xl font-semibold tracking-tight md:text-[2rem] md:leading-tight">{{ title }}</h1>
      <p v-if="description" class="mt-2 max-w-xl text-muted md:text-[0.9375rem]">{{ description }}</p>
    </div>
    <div v-if="$slots.actions" class="flex items-center gap-2">
      <slot name="actions" />
    </div>
  </header>
</template>

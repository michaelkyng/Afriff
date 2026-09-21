<script setup lang="ts">
import { SparklesIcon } from 'lucide-vue-next'

/** Build-phase marker for screens that later roadmap features will fill in. Remove before launch. */
defineProps<{
  feature: string
  title: string
  items: string[]
}>()
</script>

<template>
  <aside class="rounded-card border border-dashed border-line-strong p-5">
    <p class="flex items-center gap-2 text-xs font-semibold tracking-[0.14em] text-accent-ink uppercase">
      <SparklesIcon class="size-4" aria-hidden="true" />
      Planned · {{ feature }}
    </p>
    <p class="mt-2 font-semibold">{{ title }}</p>
    <ul class="mt-2 space-y-1 text-sm text-muted">
      <li v-for="item in items" :key="item" class="flex gap-2">
        <span class="mt-2 size-1 shrink-0 rounded-full bg-subtle" aria-hidden="true" />
        {{ item }}
      </li>
    </ul>
  </aside>
</template>

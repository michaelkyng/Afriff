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
  <aside class="rounded-card border border-dashed border-line-strong p-4 md:p-5">
    <div class="flex items-center justify-between gap-3">
      <p class="flex items-center gap-2 font-semibold">
        <SparklesIcon class="size-4 text-muted" aria-hidden="true" />
        {{ title }}
      </p>
      <UiBadge tone="info">Planned for {{ feature }}</UiBadge>
    </div>
    <ul class="mt-2.5 list-disc space-y-1 pl-10 text-meta text-muted marker:text-subtle">
      <li v-for="item in items" :key="item">{{ item }}</li>
    </ul>
  </aside>
</template>

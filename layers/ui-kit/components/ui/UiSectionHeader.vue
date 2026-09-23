<script setup lang="ts">
import { ChevronRightIcon } from 'lucide-vue-next'

/** Section title with optional inline meta (e.g. "Day 3, 14:15") and a "See all" link. */
defineProps<{
  title: string
  /** id for the heading, so a <section aria-labelledby> can point at it. */
  titleId?: string
  /** Short muted context shown after the title on the same line. */
  meta?: string
  /** Optional "See all" link. */
  to?: string
  linkLabel?: string
}>()
</script>

<template>
  <div class="mb-3 flex items-baseline justify-between gap-4 md:mb-4">
    <div class="flex min-w-0 flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
      <h2 :id="titleId" class="font-display text-h2 font-semibold">{{ title }}</h2>
      <p v-if="meta" class="text-label text-muted tabular-nums">{{ meta }}</p>
    </div>
    <NuxtLink
      v-if="to"
      :to="to"
      class="group -mr-1 inline-flex min-h-8 shrink-0 items-center gap-0.5 rounded-full py-1 pl-2 pr-1 text-label font-medium text-muted transition-colors hover:text-ink"
    >
      {{ linkLabel ?? 'See all' }}
      <ChevronRightIcon class="size-4 transition-transform duration-200 ease-out group-hover:translate-x-0.5" aria-hidden="true" />
    </NuxtLink>
  </div>
</template>

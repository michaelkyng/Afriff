<script setup lang="ts">
import { AccessibilityIcon, ArrowUpRightIcon } from 'lucide-vue-next'
import type { Venue } from '@afriff/api'

defineProps<{ venue: Venue; todayCount?: number }>()
</script>

<template>
  <article
    class="relative flex h-full flex-col rounded-card border border-line bg-surface p-5 transition-colors hover:border-line-strong has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-accent"
  >
    <p class="text-xs font-semibold tracking-[0.12em] text-muted uppercase">{{ venue.area }}</p>
    <h3 class="mt-1 font-display text-xl leading-tight font-semibold">
      <NuxtLink :to="`/venues/${venue.slug}`" class="after:absolute after:inset-0 focus-visible:outline-none">
        {{ venue.name }}
      </NuxtLink>
    </h3>
    <p class="mt-1 text-sm text-muted">
      {{ venue.screens.length === 1 ? venue.screens[0]?.name : `${venue.screens.length} screens` }}
      <template v-if="todayCount"> · {{ todayCount }} on today</template>
    </p>
    <p v-if="venue.accessibility[0]" class="mt-3 flex items-center gap-1.5 text-sm text-muted">
      <AccessibilityIcon class="size-4 shrink-0" aria-hidden="true" />
      {{ venue.accessibility[0] }}
    </p>
    <a
      :href="venue.mapsUrl"
      target="_blank"
      rel="noopener noreferrer"
      class="relative z-10 mt-auto inline-flex items-center gap-1 self-start pt-4 text-sm font-semibold text-accent-ink hover:underline"
    >
      Directions
      <ArrowUpRightIcon class="size-4" aria-hidden="true" />
      <span class="sr-only">to {{ venue.name }} (opens Maps)</span>
    </a>
  </article>
</template>

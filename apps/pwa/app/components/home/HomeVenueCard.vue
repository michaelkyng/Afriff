<script setup lang="ts">
import { AccessibilityIcon, ArrowUpRightIcon, MonitorPlayIcon } from 'lucide-vue-next'
import type { Venue } from '@afriff/api'

defineProps<{ venue: Venue; todayCount?: number }>()
</script>

<template>
  <article
    class="card card-interactive relative flex h-full flex-col p-4 has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-accent"
  >
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <h3 class="text-body font-semibold">
          <NuxtLink :to="`/venues/${venue.slug}`" class="after:absolute after:inset-0 focus-visible:outline-none">
            {{ venue.name }}
          </NuxtLink>
        </h3>
        <p class="mt-0.5 text-label text-muted">{{ venue.area }}</p>
      </div>
      <UiBadge v-if="todayCount" tone="accent" class="tabular-nums">{{ todayCount }} today</UiBadge>
    </div>
    <ul class="mt-3 space-y-1.5 text-meta text-muted">
      <li class="flex items-center gap-2">
        <MonitorPlayIcon class="size-4 shrink-0 text-subtle" aria-hidden="true" />
        {{ venue.screens.length === 1 ? venue.screens[0]?.name : `${venue.screens.length} screens` }}
      </li>
      <li v-if="venue.accessibility[0]" class="flex items-center gap-2">
        <AccessibilityIcon class="size-4 shrink-0 text-subtle" aria-hidden="true" />
        <span class="truncate">{{ venue.accessibility[0] }}</span>
      </li>
    </ul>
    <a
      :href="venue.mapsUrl"
      target="_blank"
      rel="noopener noreferrer"
      class="relative z-10 mt-auto inline-flex items-center gap-1 self-start pt-4 text-meta font-medium text-ink hover:underline"
    >
      Directions
      <ArrowUpRightIcon class="size-3.5" aria-hidden="true" />
      <span class="sr-only">to {{ venue.name }} (opens Maps)</span>
    </a>
  </article>
</template>

<script setup lang="ts">
import { ChevronRightIcon } from 'lucide-vue-next'
import type { Venue } from '@afriff/api'

/** Venues: cards on phones, a compact list in the desktop side rail. */
defineProps<{ venues: Venue[]; todayCounts: Map<string, number>; pending: boolean; layout: 'grid' | 'list' }>()
</script>

<template>
  <section id="venues" aria-labelledby="venues-title" class="scroll-mt-24">
    <UiSectionHeader title-id="venues-title" title="Venues" />

    <ul v-if="layout === 'grid'" class="grid gap-3 sm:grid-cols-2">
      <template v-if="pending">
        <li v-for="n in 4" :key="n"><UiSkeleton class="h-40 rounded-card" /></li>
      </template>
      <template v-else>
        <li v-for="venue in venues" :key="venue.id">
          <HomeVenueCard :venue="venue" :today-count="todayCounts.get(venue.id)" />
        </li>
      </template>
    </ul>

    <ul v-else class="card divide-y divide-line overflow-hidden">
      <template v-if="pending">
        <li v-for="n in 4" :key="n" class="px-3.5 py-3"><UiSkeleton class="h-9" /></li>
      </template>
      <template v-else>
        <li v-for="venue in venues" :key="venue.id">
          <NuxtLink :to="`/venues/${venue.slug}`" class="row-interactive flex items-center gap-3 px-3.5 py-3">
            <span class="min-w-0 flex-1">
              <span class="block truncate font-medium">{{ venue.name }}</span>
              <span class="block truncate text-meta text-muted">{{ venue.area }}</span>
            </span>
            <span v-if="todayCounts.get(venue.id)" class="shrink-0 text-meta text-muted tabular-nums">
              {{ todayCounts.get(venue.id) }} today
            </span>
            <ChevronRightIcon class="size-4 shrink-0 text-subtle" aria-hidden="true" />
          </NuxtLink>
        </li>
      </template>
    </ul>
  </section>
</template>

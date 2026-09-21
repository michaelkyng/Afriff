<script setup lang="ts">
import { ChevronRightIcon } from 'lucide-vue-next'
import type { Venue } from '@afriff/api'

/** Venues: cards on phones, a compact list in the desktop side rail. */
defineProps<{ venues: Venue[]; todayCounts: Map<string, number>; pending: boolean; layout: 'grid' | 'list' }>()
</script>

<template>
  <section id="venues" aria-labelledby="venues-title" class="scroll-mt-24">
    <UiSectionHeader title-id="venues-title" title="Venues" eyebrow="Getting there" />

    <ul v-if="layout === 'grid'" class="grid gap-3 sm:grid-cols-2">
      <template v-if="pending">
        <li v-for="n in 4" :key="n"><UiSkeleton class="h-44 rounded-card" /></li>
      </template>
      <template v-else>
        <li v-for="venue in venues" :key="venue.id">
          <HomeVenueCard :venue="venue" :today-count="todayCounts.get(venue.id)" />
        </li>
      </template>
    </ul>

    <ul v-else class="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
      <template v-if="pending">
        <li v-for="n in 4" :key="n" class="p-3.5"><UiSkeleton class="h-9" /></li>
      </template>
      <template v-else>
        <li v-for="venue in venues" :key="venue.id">
          <NuxtLink :to="`/venues/${venue.slug}`" class="flex items-center gap-3 p-3.5 transition-colors hover:bg-raised/60">
            <span class="min-w-0 flex-1">
              <span class="block truncate text-sm font-semibold">{{ venue.name }}</span>
              <span class="block truncate text-xs text-muted">
                {{ venue.area }}<template v-if="todayCounts.get(venue.id)"> · {{ todayCounts.get(venue.id) }} on today</template>
              </span>
            </span>
            <ChevronRightIcon class="size-4 shrink-0 text-subtle" aria-hidden="true" />
          </NuxtLink>
        </li>
      </template>
    </ul>
  </section>
</template>

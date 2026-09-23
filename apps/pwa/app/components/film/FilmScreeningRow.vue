<script setup lang="ts">
import { MessageCircleQuestionIcon } from 'lucide-vue-next'
import type { ScreeningItem } from '@afriff/api/programme'

/** One screening of a film: date, time, place, status and the ticket action. */
const props = defineProps<{ item: ScreeningItem; now: Date }>()

const start = computed(() => new Date(props.item.startsAt))
const parts = computed(() => {
  const [weekday, day, month] = formatDay(start.value).split(' ')
  return { weekday, day, month }
})
const ended = computed(() => hasEnded(props.item, props.now))
const live = computed(() => isLive(props.item, props.now))
const isGala = computed(() => props.item.screening.format === 'Gala')
</script>

<template>
  <article class="card flex items-center gap-3.5 p-3">
    <div
      class="flex w-12 shrink-0 flex-col items-center rounded-tile border border-line bg-raised py-1.5"
      :class="ended && 'opacity-60'"
      aria-hidden="true"
    >
      <span class="text-micro font-medium text-muted">{{ parts.weekday }}</span>
      <span class="text-h3 leading-6 font-semibold tabular-nums">{{ parts.day }}</span>
      <span class="text-micro text-muted">{{ parts.month }}</span>
    </div>

    <div class="min-w-0 flex-1">
      <p class="tabular-nums">
        <span class="sr-only">{{ formatLongDate(item.startsAt) }}, </span>
        <span class="font-semibold" :class="ended && 'text-muted'">{{ formatTime(item.startsAt) }}</span>
        <span class="text-meta text-muted"> · ends {{ formatTime(item.endsAt) }}</span>
      </p>
      <p class="truncate text-meta text-muted">
        <NuxtLink :to="`/venues/${item.venue.slug}`" class="transition-colors hover:text-ink hover:underline">{{
          item.venue.shortName
        }}</NuxtLink>, {{ item.room }}
      </p>
      <div
        v-if="isGala || item.screening.hasQa || (!ended && item.availability.status === 'selling_fast')"
        class="mt-1.5 flex flex-wrap gap-1"
      >
        <UiBadge v-if="isGala" tone="accent">Gala</UiBadge>
        <UiBadge v-if="item.screening.hasQa">
          <MessageCircleQuestionIcon aria-hidden="true" />
          Q&amp;A
        </UiBadge>
        <UiBadge v-if="!ended && item.availability.status === 'selling_fast'" tone="accent">
          {{ item.availability.seatsLeft }} seats left
        </UiBadge>
      </div>
    </div>

    <div class="shrink-0">
      <span v-if="ended" class="text-meta font-medium text-subtle">Screened</span>
      <UiBadge v-else-if="live" tone="accent">Showing now</UiBadge>
      <UiButton v-else-if="item.availability.status === 'sold_out'" size="sm" variant="secondary" disabled>Sold out</UiButton>
      <UiButton v-else-if="isGala" size="sm" to="/tickets">Gala tickets</UiButton>
      <UiButton v-else size="sm" :to="{ path: '/tickets', query: { screening: item.screening.id } }">Tickets</UiButton>
    </div>
  </article>
</template>

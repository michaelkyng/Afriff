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
  <article
    class="flex items-center gap-4 rounded-card border border-line bg-surface p-4"
    :class="ended && 'opacity-60'"
  >
    <div class="w-12 shrink-0 text-center" aria-hidden="true">
      <p class="text-[0.6875rem] font-semibold tracking-[0.08em] text-muted uppercase">{{ parts.weekday }}</p>
      <p class="font-display text-2xl leading-none font-semibold tabular-nums">{{ parts.day }}</p>
      <p class="text-[0.6875rem] font-medium text-muted">{{ parts.month }}</p>
    </div>

    <div class="min-w-0 flex-1">
      <p class="font-semibold tabular-nums">
        <span class="sr-only">{{ formatLongDate(item.startsAt) }}, </span>
        {{ formatTime(item.startsAt) }}–{{ formatTime(item.endsAt) }}
      </p>
      <p class="truncate text-sm text-muted">
        <NuxtLink :to="`/venues/${item.venue.slug}`" class="hover:text-ink hover:underline">{{ item.venue.shortName }}</NuxtLink>
        · {{ item.room }}
      </p>
      <div class="mt-2 flex flex-wrap gap-1.5">
        <UiBadge v-if="isGala" tone="accent">Opening Night Gala</UiBadge>
        <UiBadge v-if="item.screening.hasQa" tone="info">
          <MessageCircleQuestionIcon aria-hidden="true" />
          Q&amp;A
        </UiBadge>
        <template v-if="!ended">
          <UiBadge v-if="item.availability.status === 'sold_out'" tone="danger">Sold out</UiBadge>
          <UiBadge v-else-if="item.availability.status === 'selling_fast'" tone="accent">
            {{ item.availability.seatsLeft }} seats left
          </UiBadge>
          <UiBadge v-else tone="success">Available</UiBadge>
        </template>
      </div>
    </div>

    <div class="shrink-0">
      <span v-if="ended" class="text-sm font-medium text-muted">Screened</span>
      <UiBadge v-else-if="live" tone="accent">Now showing</UiBadge>
      <UiButton v-else-if="item.availability.status === 'sold_out'" size="sm" variant="secondary" disabled>Sold out</UiButton>
      <UiButton v-else-if="isGala" size="sm" to="/passes">Gala tickets</UiButton>
      <UiButton v-else size="sm" :to="{ path: '/passes', query: { screening: item.screening.id } }">Tickets</UiButton>
    </div>
  </article>
</template>

<script setup lang="ts">
import {
  GraduationCapIcon,
  MessageCircleQuestionIcon,
  MessagesSquareIcon,
  PartyPopperIcon,
  SparklesIcon,
  TrophyIcon,
} from 'lucide-vue-next'
import type { Component } from 'vue'
import type { EventKind } from '@afriff/api'
import type { ProgrammeItem } from '@afriff/api/programme'

/** One slot on the timeline — a screening or an event — with time, place and status. */
const props = defineProps<{
  item: ProgrammeItem
  now: Date
  /** Show the day as well as the time (for lists that span days). */
  showDay?: boolean
  /** Makes the whole card a link (stretched link on the title). */
  to?: string
}>()

const eventIcons: Record<EventKind, Component> = {
  gala: SparklesIcon,
  masterclass: GraduationCapIcon,
  panel: MessagesSquareIcon,
  awards: TrophyIcon,
  social: PartyPopperIcon,
}

const eventLabels: Record<EventKind, string> = {
  gala: 'Gala',
  masterclass: 'Masterclass',
  panel: 'Panel',
  awards: 'Awards',
  social: 'Social',
}

const live = computed(() => isLive(props.item, props.now))
const ended = computed(() => hasEnded(props.item, props.now))
const progress = computed(() => progressOf(props.item, props.now))
</script>

<template>
  <article
    class="relative flex gap-3.5 overflow-hidden rounded-card border bg-surface p-3.5 transition-colors has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-accent"
    :class="[live ? 'border-accent/40' : 'border-line', to && 'hover:border-line-strong', ended && 'opacity-60']"
  >
    <!-- Thumb -->
    <div class="w-14 shrink-0">
      <FilmPoster v-if="item.kind === 'screening'" :film="item.film" :show-text="false" size="sm" class="rounded-lg" />
      <div
        v-else
        class="grid aspect-[2/3] place-items-center rounded-lg bg-accent-soft text-accent-ink"
        aria-hidden="true"
      >
        <component :is="eventIcons[item.event.kind]" class="size-6" />
      </div>
    </div>

    <!-- Body -->
    <div class="min-w-0 flex-1">
      <p class="flex items-center gap-2 text-xs font-semibold text-muted">
        <span v-if="live" class="inline-flex items-center gap-1.5 text-accent-ink">
          <span class="relative flex size-2" aria-hidden="true">
            <span class="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-60" />
            <span class="relative inline-flex size-2 rounded-full bg-accent" />
          </span>
          Now showing
        </span>
        <span v-else class="tabular-nums">
          <template v-if="ended">Ended · </template>
          <template v-if="showDay">{{ formatDay(item.startsAt) }} · </template>{{ formatTime(item.startsAt) }}–{{ formatTime(item.endsAt) }}
        </span>
      </p>

      <h3 class="mt-1 truncate font-semibold">
        <NuxtLink v-if="to" :to="to" class="after:absolute after:inset-0 focus-visible:outline-none">{{ item.title }}</NuxtLink>
        <template v-else>{{ item.title }}</template>
      </h3>
      <p class="mt-0.5 truncate text-sm text-muted">{{ item.venue.shortName }} · {{ item.room }}</p>

      <div class="mt-2 flex flex-wrap gap-1.5">
        <template v-if="item.kind === 'screening'">
          <UiBadge v-if="item.screening.format === 'Gala'" tone="accent">Gala</UiBadge>
          <UiBadge v-if="item.screening.hasQa" tone="info">
            <MessageCircleQuestionIcon aria-hidden="true" />
            Q&amp;A
          </UiBadge>
          <UiBadge v-if="item.availability.status === 'sold_out'" tone="danger">Sold out</UiBadge>
          <UiBadge v-else-if="item.availability.status === 'selling_fast'" tone="accent">
            {{ item.availability.seatsLeft }} seats left
          </UiBadge>
          <UiBadge v-if="item.section && !live" tone="neutral">{{ item.section.name }}</UiBadge>
        </template>
        <template v-else>
          <UiBadge tone="accent">{{ eventLabels[item.event.kind] }}</UiBadge>
          <UiBadge v-if="item.product" tone="neutral">{{ formatMoney(item.product.price) }}</UiBadge>
          <UiBadge v-else tone="neutral">Pass holders</UiBadge>
        </template>
      </div>
    </div>

    <!-- Live progress -->
    <div
      v-if="live"
      class="absolute inset-x-0 bottom-0 h-1 bg-line"
      role="progressbar"
      :aria-valuenow="Math.round(progress * 100)"
      aria-valuemin="0"
      aria-valuemax="100"
      :aria-label="`${item.title}: ${Math.round(progress * 100)}% through, ends ${formatTime(item.endsAt)}`"
    >
      <div class="h-full bg-accent transition-[width] duration-1000" :style="{ width: `${progress * 100}%` }" />
    </div>
  </article>
</template>

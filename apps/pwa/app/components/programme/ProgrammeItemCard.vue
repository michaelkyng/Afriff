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

/** One slot on the timeline (a screening or an event) with time, place and status. */
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
const duration = computed(() =>
  formatRuntime(Math.round((Date.parse(props.item.endsAt) - Date.parse(props.item.startsAt)) / 60_000)),
)

/** Right-hand status: seats for screenings, price or access for events. */
const status = computed<{ text: string; tone: string } | null>(() => {
  const item = props.item
  if (ended.value) return { text: 'Ended', tone: 'text-subtle' }
  if (item.kind === 'screening') {
    if (item.availability.status === 'sold_out') return { text: 'Sold out', tone: 'text-danger' }
    if (item.availability.status === 'selling_fast') return { text: `${item.availability.seatsLeft} left`, tone: 'text-accent-ink' }
    return null
  }
  return item.product
    ? { text: formatMoney(item.product.price), tone: 'text-ink' }
    : { text: 'Included', tone: 'text-muted' }
})
</script>

<template>
  <article
    class="card relative flex gap-3 overflow-hidden p-3 has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-accent"
    :class="[to && 'card-interactive', live && 'border-accent/35']"
  >
    <!-- Thumb -->
    <div class="w-12 shrink-0">
      <FilmPoster
        v-if="item.kind === 'screening'"
        :film="item.film"
        :show-text="false"
        size="sm"
        class="transition-[filter,opacity] duration-200"
        :class="ended && 'opacity-50 grayscale'"
      />
      <div
        v-else
        class="grid aspect-[2/3] place-items-center rounded-thumb border border-line bg-raised text-muted"
        aria-hidden="true"
      >
        <component :is="eventIcons[item.event.kind]" class="size-5" :stroke-width="1.75" />
      </div>
    </div>

    <!-- Body -->
    <div class="flex min-w-0 flex-1 flex-col">
      <div class="flex items-baseline justify-between gap-3 text-meta tabular-nums">
        <p v-if="live" class="truncate">
          <span class="font-semibold text-accent-ink">Now</span>
          <span class="text-muted"> · ends {{ formatTime(item.endsAt) }}</span>
        </p>
        <p v-else class="truncate">
          <span class="font-semibold" :class="ended ? 'text-muted' : 'text-ink'">
            <template v-if="showDay">{{ formatDay(item.startsAt) }}, </template>{{ formatTime(item.startsAt) }}
          </span>
          <span class="text-muted"> · {{ duration }}</span>
        </p>
        <p v-if="status" class="shrink-0 text-label font-medium" :class="status.tone">{{ status.text }}</p>
      </div>

      <h3 class="mt-1 line-clamp-2 leading-snug font-semibold" :class="ended && 'text-muted'">
        <NuxtLink v-if="to" :to="to" class="after:absolute after:inset-0 focus-visible:outline-none">{{ item.title }}</NuxtLink>
        <template v-else>{{ item.title }}</template>
      </h3>
      <p class="mt-0.5 truncate text-meta text-muted">{{ item.venue.shortName }}, {{ item.room }}</p>

      <div class="mt-auto flex flex-wrap gap-1 pt-2">
        <template v-if="item.kind === 'screening'">
          <UiBadge v-if="item.screening.format === 'Gala'" tone="accent">Gala</UiBadge>
          <UiBadge v-if="item.screening.hasQa">
            <MessageCircleQuestionIcon aria-hidden="true" />
            Q&amp;A
          </UiBadge>
          <UiBadge v-if="item.section">{{ item.section.name }}</UiBadge>
        </template>
        <UiBadge v-else>{{ eventLabels[item.event.kind] }}</UiBadge>
      </div>
    </div>

    <!-- Live progress -->
    <div
      v-if="live"
      class="absolute inset-x-0 bottom-0 h-0.5 bg-accent/15"
      role="progressbar"
      :aria-valuenow="Math.round(progress * 100)"
      aria-valuemin="0"
      aria-valuemax="100"
      :aria-label="`${item.title}: ${Math.round(progress * 100)}% through, ends ${formatTime(item.endsAt)}`"
    >
      <div
        class="h-full origin-left bg-accent transition-transform duration-1000 ease-linear"
        :style="{ transform: `scaleX(${progress})` }"
      />
    </div>
  </article>
</template>

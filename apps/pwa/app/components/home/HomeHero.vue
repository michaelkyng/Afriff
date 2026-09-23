<script setup lang="ts">
import { ArrowRightIcon, CalendarDaysIcon, MapPinIcon } from 'lucide-vue-next'
import type { Festival, FestivalDay } from '@afriff/api'
import type { DurationParts } from '@afriff/api/format'
import type { FestivalPhase } from '~/composables/useFestivalClock'

const props = defineProps<{
  festival: Festival | null | undefined
  phase: FestivalPhase | null
  today: FestivalDay | null
  countdown: DurationParts | null
  isSimulated: boolean
  venueCount?: number
  /** Screenings + events on today's date (during the festival). */
  todayCount?: number
}>()

const tiles = computed(() => {
  const c = props.countdown
  if (!c) return []
  return [
    { label: 'Days', value: c.days },
    { label: 'Hours', value: c.hours },
    { label: 'Mins', value: c.minutes },
    { label: 'Secs', value: c.seconds },
  ]
})

const pad = (n: number) => String(n).padStart(2, '0')
</script>

<template>
  <section
    class="grain relative overflow-hidden rounded-card border border-white/10 bg-navy-950 text-white shadow-card"
    aria-labelledby="hero-title"
  >
    <div
      class="pointer-events-none absolute inset-0"
      style="
        background:
          radial-gradient(60% 80% at 85% 18%, rgb(217 164 65 / 0.2), transparent 60%),
          radial-gradient(55% 65% at 8% 100%, rgb(0 104 166 / 0.45), transparent 70%),
          linear-gradient(160deg, #0a1042 0%, #060a26 70%);
      "
      aria-hidden="true"
    />

    <div class="relative z-2 grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:gap-x-6 md:gap-y-4 md:px-6 md:py-5 lg:gap-x-8">
      <div class="min-w-0">
        <span
          v-if="isSimulated"
          class="mb-2 inline-flex items-center rounded-full border border-white/15 px-2 py-px text-micro font-medium text-white/80"
        >
          Simulated time
        </span>

        <h1 id="hero-title" class="max-w-[28ch] text-balance font-display text-2xl leading-7 font-semibold tracking-tight lg:text-[2rem] lg:leading-9">
          <template v-if="festival">{{ festival.tagline }}</template>
          <UiSkeleton v-else class="h-16 w-full bg-white/10" />
        </h1>

        <dl class="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5 text-[0.71875rem] text-white/75">
          <div class="flex items-center gap-1.5">
            <dt class="sr-only">Dates</dt>
            <CalendarDaysIcon class="size-3.5 text-gold-300" aria-hidden="true" />
            <dd>{{ festival ? formatDateRange(festival.startsAt, festival.endsAt) : 'Dates to be announced' }}</dd>
          </div>
          <div class="flex items-center gap-1.5">
            <dt class="sr-only">Venues</dt>
            <MapPinIcon class="size-3.5 text-gold-300" aria-hidden="true" />
            <dd>{{ venueCount ? `${venueCount} venues across Lagos` : 'Venues across Lagos' }}</dd>
          </div>
        </dl>
      </div>

      <!-- The clock shares the banner width instead of adding a full row on desktop. -->
      <div v-if="phase" class="border-t border-white/10 pt-3 md:col-start-2 md:row-span-2 md:row-start-1 md:w-60 md:self-center md:border-t-0 md:border-l md:pt-0 md:pl-6 lg:w-64" aria-live="off">
        <div v-if="phase === 'before'" role="timer" aria-label="Time until the festival opens">
          <p class="mb-2 text-meta text-white/70">Opening night in</p>
          <ol class="grid grid-cols-4 gap-2">
            <li
              v-for="tile in tiles"
              :key="tile.label"
              class="rounded-tile bg-white/5 px-1 py-1.5 text-center"
            >
              <span class="block font-display text-2xl leading-7 font-semibold tabular-nums">{{ pad(tile.value) }}</span>
              <span class="block text-micro text-white/60">{{ tile.label }}</span>
            </li>
          </ol>
        </div>

        <div v-else-if="phase === 'during'">
          <p class="font-display text-2xl leading-7 font-semibold tabular-nums">
            Day {{ today?.number }} <span class="text-white/55">of {{ festival?.days.length }}</span>
          </p>
          <p class="mt-1 text-meta text-white/70">
            {{ today?.label }}<template v-if="today?.highlight">, {{ today.highlight }}</template>
            <template v-if="todayCount"> · {{ todayCount }} screenings and events</template>
          </p>
        </div>

        <div v-else-if="phase === 'after'">
          <p class="font-display text-2xl leading-7 font-semibold">That’s a wrap.</p>
          <p class="mt-1 text-meta text-white/70">Thank you for seven days of African cinema. See you next year.</p>
        </div>
      </div>

      <div class="flex flex-wrap gap-2 md:col-start-1">
        <UiButton v-if="phase !== 'after'" to="/tickets" class="px-3! text-meta!">Get tickets</UiButton>
        <UiButton
          to="/programme"
          variant="ghost"
          class="border border-white/20 px-3! text-meta! text-white hover:bg-white/10!"
        >
          <template v-if="phase === 'after'">Revisit the programme</template>
          <template v-else><span class="max-sm:hidden">Browse programme</span><span class="sm:hidden">Programme</span></template>
          <ArrowRightIcon aria-hidden="true" />
        </UiButton>
      </div>
    </div>
  </section>
</template>

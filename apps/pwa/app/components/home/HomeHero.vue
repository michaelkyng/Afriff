<script setup lang="ts">
import { ArrowRightIcon, CalendarDaysIcon, MapPinIcon } from 'lucide-vue-next'
import type { Festival, FestivalDay, Film } from '@afriff/api'
import type { DurationParts } from '@afriff/api/format'
import type { FestivalPhase } from '~/composables/useFestivalClock'

const props = defineProps<{
  festival: Festival | null | undefined
  phase: FestivalPhase | null
  today: FestivalDay | null
  countdown: DurationParts | null
  isSimulated: boolean
  /** Up to three films for the poster fan. */
  posters: Film[]
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

    <div class="relative z-[2] grid gap-8 p-5 md:grid-cols-[1.4fr_1fr] md:items-center md:gap-6 md:p-8 lg:px-10">
      <div>
        <span
          v-if="isSimulated"
          class="mb-4 inline-flex h-6 items-center rounded-full border border-white/15 px-2.5 text-label font-medium text-white/80"
        >
          Simulated time
        </span>

        <h1 id="hero-title" class="max-w-[20ch] font-display text-display font-semibold md:text-[2.5rem] md:leading-[2.75rem]">
          <template v-if="festival">{{ festival.tagline }}</template>
          <UiSkeleton v-else class="h-20 w-full bg-white/10" />
        </h1>

        <dl class="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-meta text-white/75">
          <div class="flex items-center gap-1.5">
            <dt class="sr-only">Dates</dt>
            <CalendarDaysIcon class="size-4 text-gold-300" aria-hidden="true" />
            <dd>{{ festival ? formatDateRange(festival.startsAt, festival.endsAt) : 'Dates to be announced' }}</dd>
          </div>
          <div class="flex items-center gap-1.5">
            <dt class="sr-only">Venues</dt>
            <MapPinIcon class="size-4 text-gold-300" aria-hidden="true" />
            <dd>{{ venueCount ? `${venueCount} venues across Lagos` : 'Venues across Lagos' }}</dd>
          </div>
        </dl>

        <!-- Festival clock -->
        <div class="mt-7 md:mt-6" aria-live="off">
          <div v-if="phase === 'before'" role="timer" aria-label="Time until the festival opens">
            <p class="mb-2.5 text-meta text-white/70">Opening night in</p>
            <ol class="grid max-w-sm grid-cols-4 gap-2">
              <li
                v-for="tile in tiles"
                :key="tile.label"
                class="rounded-tile border border-white/10 bg-white/[0.05] px-2 py-2.5 text-center"
              >
                <span class="block font-display text-h1 font-semibold tabular-nums">{{ pad(tile.value) }}</span>
                <span class="block text-micro text-white/60">{{ tile.label }}</span>
              </li>
            </ol>
          </div>

          <div v-else-if="phase === 'during'">
            <p class="font-display text-h1 font-semibold tabular-nums">
              Day {{ today?.number }} <span class="text-white/55">of {{ festival?.days.length }}</span>
            </p>
            <p class="mt-1 text-meta text-white/70">
              {{ today?.label }}<template v-if="today?.highlight">, {{ today.highlight }}</template>
              <template v-if="todayCount"> · {{ todayCount }} screenings and events</template>
            </p>
          </div>

          <div v-else-if="phase === 'after'">
            <p class="font-display text-h1 font-semibold">That’s a wrap.</p>
            <p class="mt-1 text-meta text-white/70">Thank you for seven days of African cinema. See you next year.</p>
          </div>
        </div>

        <div class="mt-7 flex flex-wrap gap-2.5 md:mt-6">
          <UiButton v-if="phase !== 'after'" to="/passes">Get passes</UiButton>
          <UiButton
            to="/programme"
            variant="ghost"
            class="border border-white/20 text-white hover:bg-white/10!"
          >
            <template v-if="phase === 'after'">Revisit the programme</template>
            <template v-else><span class="max-sm:hidden">Browse programme</span><span class="sm:hidden">Programme</span></template>
            <ArrowRightIcon aria-hidden="true" />
          </UiButton>
        </div>
      </div>

      <!-- Poster fan -->
      <div class="relative mx-auto hidden h-72 w-full max-w-sm md:block" aria-hidden="true">
        <template v-if="posters.length">
          <div
            v-for="(film, i) in posters.slice(0, 3)"
            :key="film.id"
            class="absolute top-1/2 left-1/2 w-40"
            :class="[
              i === 0 && '-translate-x-[108%] -translate-y-[46%] -rotate-[9deg]',
              i === 1 && 'z-10 -translate-x-1/2 -translate-y-1/2',
              i === 2 && 'translate-x-[8%] -translate-y-[46%] rotate-[9deg]',
            ]"
          >
            <FilmPoster :film="film" :show-text="i === 1" :class="i !== 1 && 'opacity-70'" />
          </div>
        </template>
        <div v-else class="absolute top-1/2 left-1/2 w-40 -translate-x-1/2 -translate-y-1/2">
          <UiSkeleton class="aspect-[2/3] bg-white/10" />
        </div>
      </div>
    </div>
  </section>
</template>

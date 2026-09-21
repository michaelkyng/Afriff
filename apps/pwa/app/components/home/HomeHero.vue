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
const isPhone = useMediaQuery('(max-width: 767px)')
</script>

<template>
  <section
    class="grain relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-navy-950 text-white"
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

    <div class="relative z-[2] grid gap-10 p-6 md:grid-cols-[1.4fr_1fr] md:items-center md:gap-6 md:p-8 lg:px-10">
      <div>
        <div class="flex flex-wrap items-center gap-2">
          <p class="text-xs font-semibold tracking-[0.18em] text-gold-300 uppercase">
            {{ festival?.editionTitle ?? 'AFRIFF' }} · {{ festival?.city ?? 'Lagos' }}
          </p>
          <span v-if="isSimulated" class="rounded-full bg-white/12 px-2.5 py-0.5 text-xs font-semibold text-white/85">
            Simulated time
          </span>
        </div>

        <h1 id="hero-title" class="mt-4 font-display text-[2.5rem] leading-[1.08] font-semibold tracking-[-0.035em] md:mt-3 md:text-[2.5rem]">
          <template v-if="festival">{{ festival.tagline }}</template>
          <UiSkeleton v-else class="h-24 w-full bg-white/10" />
        </h1>

        <dl class="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-white/75">
          <div class="flex items-center gap-2">
            <dt class="sr-only">Dates</dt>
            <CalendarDaysIcon class="size-4 text-gold-300" aria-hidden="true" />
            <dd>{{ festival ? formatDateRange(festival.startsAt, festival.endsAt) : '—' }}</dd>
          </div>
          <div class="flex items-center gap-2">
            <dt class="sr-only">Venues</dt>
            <MapPinIcon class="size-4 text-gold-300" aria-hidden="true" />
            <dd>{{ venueCount ? `${venueCount} venues across Lagos` : 'Venues across Lagos' }}</dd>
          </div>
        </dl>

        <!-- Festival clock -->
        <div class="mt-8 md:mt-6" aria-live="off">
          <div v-if="phase === 'before'" role="timer" aria-label="Time until the festival opens">
            <p class="mb-3 text-sm font-medium text-white/70">Opening night in</p>
            <ol class="grid max-w-md grid-cols-4 gap-2">
              <li
                v-for="tile in tiles"
                :key="tile.label"
                class="rounded-2xl border border-white/10 bg-white/[0.06] px-2 py-3 text-center backdrop-blur"
              >
                <span class="block font-display text-3xl font-semibold tabular-nums">{{ pad(tile.value) }}</span>
                <span class="mt-0.5 block text-[0.6875rem] font-semibold tracking-[0.14em] text-white/60 uppercase">
                  {{ tile.label }}
                </span>
              </li>
            </ol>
          </div>

          <div v-else-if="phase === 'during'">
            <p class="font-display text-3xl font-semibold">
              Day {{ today?.number ?? '–' }} <span class="text-white/55">of {{ festival?.days.length }}</span>
            </p>
            <p class="mt-1 text-sm text-white/70">
              {{ today?.label }}<template v-if="today?.highlight"> · {{ today.highlight }}</template>
              <template v-if="todayCount"> · {{ todayCount }} screenings &amp; events today</template>
            </p>
          </div>

          <div v-else-if="phase === 'after'">
            <p class="font-display text-3xl font-semibold">That’s a wrap.</p>
            <p class="mt-1 text-sm text-white/70">Thank you for seven days of African cinema. See you next year.</p>
          </div>
        </div>

        <div class="mt-8 flex flex-wrap gap-3 md:mt-6">
          <UiButton v-if="phase !== 'after'" to="/passes" :size="isPhone ? 'lg' : 'md'">Get passes</UiButton>
          <UiButton
            to="/programme"
            :size="isPhone ? 'lg' : 'md'"
            variant="ghost"
            class="border border-white/20 text-white hover:bg-white/10"
          >
            {{ phase === 'after' ? 'Revisit the programme' : 'Browse programme' }}
            <ArrowRightIcon aria-hidden="true" />
          </UiButton>
        </div>
      </div>

      <!-- Poster fan -->
      <div class="relative mx-auto -mt-2 h-52 w-full max-w-sm md:mt-0 md:h-72" aria-hidden="true">
        <template v-if="posters.length">
          <div
            v-for="(film, i) in posters.slice(0, 3)"
            :key="film.id"
            class="absolute top-1/2 left-1/2 w-28 md:w-40"
            :class="[
              i === 0 && '-translate-x-[108%] -translate-y-[46%] -rotate-[9deg]',
              i === 1 && 'z-10 -translate-x-1/2 -translate-y-1/2',
              i === 2 && 'translate-x-[8%] -translate-y-[46%] rotate-[9deg]',
            ]"
          >
            <FilmPoster :film="film" :show-text="i === 1" :class="i !== 1 && 'opacity-70'" />
          </div>
        </template>
        <div v-else class="absolute top-1/2 left-1/2 w-28 -translate-x-1/2 -translate-y-1/2 md:w-40">
          <UiSkeleton class="aspect-[2/3] bg-white/10" />
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { CalendarDaysIcon, FilmIcon, RefreshCwIcon, SearchXIcon, SlidersHorizontalIcon, TriangleAlertIcon, XIcon } from 'lucide-vue-next'
import type { Genre } from '@afriff/api'
import type { FilterGroup } from '~/composables/useProgrammeFilters'
import type { ProgrammeItem } from '@afriff/api/programme'
import type { ProgrammeView } from '@afriff/api/filters'

useHead({ title: 'Programme' })

const { data: festival } = useFestival()
const { data: programme, timeline, lookups, pending, error, refresh } = useProgramme()
const { now, phase, today } = useFestivalClock(festival)
const { filters, view, day, activeCount, toggle, clearAll, setView, setDay, setQuery } = useProgrammeFilters()

const filtersOpen = ref(false)

const viewModel = computed<ProgrammeView>({ get: () => view.value, set: (value) => setView(value) })
const viewOptions = [
  { value: 'schedule' as const, label: 'Schedule', icon: CalendarDaysIcon },
  { value: 'films' as const, label: 'Films A–Z', icon: FilmIcon },
]

const search = computed({ get: () => filters.value.q, set: (value: string) => setQuery(value) })

// ------------------------------------------------------------------ schedule

/** Day shown in the schedule: from the URL, else today during the festival, else opening day. */
const selectedDay = computed<string>({
  get: () => {
    if (day.value) return day.value
    if (phase.value === 'during' && today.value) return today.value.date
    return festival.value?.days[0]?.date ?? ''
  },
  set: (value) => setDay(value),
})
const selectedDayInfo = computed(() => festival.value?.days.find((d) => d.date === selectedDay.value))

const matchingItems = computed(() => timeline.value.filter((item) => itemMatches(item, filters.value)))

const dayCounts = computed(() => {
  const counts: Record<string, number> = {}
  for (const item of matchingItems.value) {
    const key = lagosDateKey(item.startsAt)
    counts[key] = (counts[key] ?? 0) + 1
  }
  return counts
})

const allDayItems = computed(() => matchingItems.value.filter((item) => lagosDateKey(item.startsAt) === selectedDay.value))

/** On today's schedule, listings that have finished are tucked away until asked for. */
const showEarlier = ref(false)
watch(selectedDay, () => (showEarlier.value = false))
const endedCount = computed(() => allDayItems.value.filter((item) => hasEnded(item, now.value)).length)
const dayItems = computed(() =>
  showEarlier.value ? allDayItems.value : allDayItems.value.filter((item) => !hasEnded(item, now.value)),
)

/** Slots grouped under their start time. */
const groups = computed(() => {
  const map = new Map<string, ProgrammeItem[]>()
  for (const item of dayItems.value) {
    const key = formatTime(item.startsAt)
    map.set(key, [...(map.get(key) ?? []), item])
  }
  return [...map.entries()].map(([time, items]) => ({ time, items }))
})

/** Other days that do have matches, to suggest when the selected day is empty. */
const otherDays = computed(() =>
  (festival.value?.days ?? []).filter((d) => d.date !== selectedDay.value && (dayCounts.value[d.date] ?? 0) > 0),
)

// ------------------------------------------------------------------ films view

const matchingFilms = computed(() =>
  (programme.value?.films ?? [])
    .filter((film) => filmMatches(film, filters.value, lookups.value?.section.get(film.sectionId)?.slug))
    .sort((a, b) => a.title.localeCompare(b.title)),
)

// ------------------------------------------------------------------ facets

const facetGenres = computed<Genre[]>(() => [...new Set(programme.value?.films.flatMap((f) => f.genres) ?? [])].sort())

const facetLanguages = computed(() => {
  const counts = new Map<string, number>()
  for (const film of programme.value?.films ?? []) {
    for (const lang of film.languages) counts.set(lang, (counts.get(lang) ?? 0) + 1)
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([lang]) => lang)
})

const facetSections = computed(() =>
  (programme.value?.sections ?? []).filter((s) => programme.value?.films.some((f) => f.sectionId === s.id)),
)

/** One removable chip per active filter. */
const activeChips = computed(() => {
  const f = filters.value
  const sectionName = (slug: string) => programme.value?.sections.find((s) => s.slug === slug)?.name ?? slug
  const venueName = (slug: string) => programme.value?.venues.find((v) => v.slug === slug)?.shortName ?? slug
  const timeName = (value: string) => TIMES_OF_DAY.find((t) => t.value === value)?.label ?? value
  const chips: { group: FilterGroup; value: string; label: string }[] = [
    ...f.sections.map((v) => ({ group: 'sections' as const, value: v, label: sectionName(v) })),
    ...(view.value === 'schedule' ? f.venues.map((v) => ({ group: 'venues' as const, value: v, label: venueName(v) })) : []),
    ...(view.value === 'schedule' ? f.times.map((v) => ({ group: 'times' as const, value: v, label: timeName(v) })) : []),
    ...f.genres.map((v) => ({ group: 'genres' as const, value: v, label: v })),
    ...f.languages.map((v) => ({ group: 'languages' as const, value: v, label: v })),
  ]
  return chips
})

const resultCount = computed(() => (view.value === 'films' ? matchingFilms.value.length : dayItems.value.length))
const resultNoun = computed(() => {
  if (view.value === 'films') return resultCount.value === 1 ? 'film' : 'films'
  return `${resultCount.value === 1 ? 'listing' : 'listings'}${selectedDayInfo.value ? ` on ${selectedDayInfo.value.label}` : ''}`
})
</script>

<template>
  <div class="space-y-6">
    <AppPageHeader
      title="Programme"
      :eyebrow="festival ? formatDateRange(festival.startsAt, festival.endsAt) : 'Official selection'"
    >
      <template #actions>
        <UiSegmented v-model="viewModel" :options="viewOptions" label="View" />
      </template>
    </AppPageHeader>

    <!-- Search + filters -->
    <div class="flex gap-2">
      <UiSearchInput
        v-model="search"
        class="flex-1"
        :placeholder="view === 'films' ? 'Search films, directors, countries' : 'Search films, people, events'"
        label="Search the programme"
      />
      <UiButton variant="secondary" class="relative" :aria-label="`Filters${activeCount ? `, ${activeCount} active` : ''}`" @click="filtersOpen = true">
        <SlidersHorizontalIcon aria-hidden="true" />
        <span class="max-sm:sr-only">Filters</span>
        <span
          v-if="activeCount"
          class="grid size-5 place-items-center rounded-full bg-accent text-[0.6875rem] font-bold text-on-accent"
          aria-hidden="true"
        >
          {{ activeCount }}
        </span>
      </UiButton>
    </div>

    <!-- Active filters -->
    <div v-if="activeChips.length" class="flex flex-wrap items-center gap-2" aria-label="Active filters">
      <button
        v-for="chip in activeChips"
        :key="`${chip.group}:${chip.value}`"
        type="button"
        class="inline-flex h-8 items-center gap-1.5 rounded-full bg-accent-soft pr-2 pl-3 text-sm font-medium text-accent-ink hover:bg-accent/25"
        :aria-label="`Remove filter: ${chip.label}`"
        @click="toggle(chip.group, chip.value)"
      >
        {{ chip.label }}
        <XIcon class="size-3.5" aria-hidden="true" />
      </button>
      <button type="button" class="px-2 text-sm font-semibold text-muted hover:text-ink" @click="clearAll()">Clear all</button>
    </div>

    <UiEmptyState
      v-if="error && !programme"
      :icon="TriangleAlertIcon"
      title="We couldn’t load the programme"
      description="Check your connection and try again."
    >
      <UiButton variant="secondary" @click="refresh()">
        <RefreshCwIcon aria-hidden="true" />
        Try again
      </UiButton>
    </UiEmptyState>

    <!-- ================================================= Schedule -->
    <template v-else-if="view === 'schedule'">
      <div
        class="sticky top-[calc(3.5rem+env(safe-area-inset-top,0px))] z-30 -mx-4 border-b border-line bg-canvas/90 px-4 py-3 backdrop-blur-xl md:top-[calc(4rem+env(safe-area-inset-top,0px))] md:-mx-8 md:px-8"
      >
        <ProgrammeDayPicker
          v-if="festival"
          v-model="selectedDay"
          :days="festival.days"
          :counts="programme ? dayCounts : undefined"
          :today="phase === 'during' ? today?.date : null"
        />
        <div v-else class="flex gap-2">
          <UiSkeleton v-for="n in 7" :key="n" class="h-[4.75rem] w-[3.75rem] shrink-0 rounded-2xl" />
        </div>
      </div>

      <div v-if="pending" class="space-y-3">
        <UiSkeleton class="h-5 w-20" />
        <div class="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <UiSkeleton v-for="n in 6" :key="n" class="h-[7.5rem] rounded-card" />
        </div>
      </div>

      <div v-else-if="groups.length || endedCount" class="space-y-7">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <p class="text-sm text-muted" role="status">
            <span class="font-semibold text-ink">{{ selectedDayInfo?.label }}</span>
            <template v-if="selectedDayInfo?.highlight"> · {{ selectedDayInfo.highlight }}</template>
            · {{ allDayItems.length }} {{ allDayItems.length === 1 ? 'listing' : 'listings' }}
          </p>
          <button
            v-if="endedCount"
            type="button"
            class="text-sm font-semibold text-accent-ink hover:underline"
            :aria-pressed="showEarlier"
            @click="showEarlier = !showEarlier"
          >
            {{ showEarlier ? 'Hide finished' : `Show ${endedCount} finished` }}
          </button>
        </div>
        <p v-if="!groups.length" class="text-muted">Everything on {{ selectedDayInfo?.label }} has finished.</p>
        <section v-for="group in groups" :key="group.time" :aria-label="`Starting at ${group.time}`">
          <h2 class="mb-3 flex items-center gap-3 text-sm font-semibold text-muted tabular-nums">
            <span class="font-display text-xl text-ink">{{ group.time }}</span>
            <span class="h-px flex-1 bg-line" aria-hidden="true" />
          </h2>
          <ul class="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            <li v-for="item in group.items" :key="item.id">
              <ProgrammeItemCard :item="item" :now="now" :to="programmeItemLink(item)" />
            </li>
          </ul>
        </section>
      </div>

      <UiEmptyState
        v-else
        :icon="SearchXIcon"
        :title="`Nothing on ${selectedDayInfo?.label ?? 'this day'}`"
        :description="otherDays.length ? 'Your filters match listings on other days:' : 'Nothing in the programme matches these filters.'"
      >
        <UiButton v-for="d in otherDays.slice(0, 4)" :key="d.date" variant="secondary" size="sm" @click="selectedDay = d.date">
          {{ d.label }} · {{ dayCounts[d.date] }}
        </UiButton>
        <UiButton v-if="activeCount || filters.q" size="sm" @click="clearAll()">Clear filters</UiButton>
      </UiEmptyState>
    </template>

    <!-- ================================================= Films A–Z -->
    <template v-else>
      <ul v-if="pending" class="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-5">
        <li v-for="n in 10" :key="n" class="space-y-2">
          <UiSkeleton class="aspect-[2/3]" />
          <UiSkeleton class="h-4 w-3/4" />
          <UiSkeleton class="h-3 w-1/2" />
        </li>
      </ul>
      <template v-else-if="matchingFilms.length">
        <p class="text-sm text-muted" role="status">
          {{ matchingFilms.length }} {{ matchingFilms.length === 1 ? 'film' : 'films' }}
        </p>
        <ul class="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-5">
          <li v-for="film in matchingFilms" :key="film.id">
            <FilmCard :film="film" :section="lookups?.section.get(film.sectionId)" show-premiere />
          </li>
        </ul>
      </template>
      <UiEmptyState v-else :icon="SearchXIcon" title="No films match" description="Try a different search or fewer filters.">
        <UiButton size="sm" @click="clearAll()">Clear filters</UiButton>
      </UiEmptyState>
    </template>

    <ProgrammeFilterSheet
      v-if="programme"
      v-model:open="filtersOpen"
      :sections="facetSections"
      :venues="programme.venues"
      :genres="facetGenres"
      :languages="facetLanguages"
      :result-count="resultCount"
      :result-noun="resultNoun"
      :films-only="view === 'films'"
    />
  </div>
</template>

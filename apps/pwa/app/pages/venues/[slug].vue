<script setup lang="ts">
import { AccessibilityIcon, ArrowUpRightIcon, CheckIcon, MapPinIcon, MonitorPlayIcon, SearchXIcon } from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()
const slug = computed(() => String(route.params.slug))

const { data: festival } = useFestival()
const { data: programme, timeline, pending } = useProgramme()
const { now, phase, today } = useFestivalClock(festival)

const venue = computed(() => programme.value?.venues.find((v) => v.slug === slug.value) ?? null)

watchEffect(() => {
  if (programme.value && !venue.value) showError({ statusCode: 404, statusMessage: 'Venue not found' })
})

useHead({ title: () => venue.value?.name ?? 'Venue' })
usePageCrumb(() => venue.value?.name)

const venueItems = computed(() => timeline.value.filter((item) => item.venue.slug === slug.value))

const dayCounts = computed(() => {
  const counts: Record<string, number> = {}
  for (const item of venueItems.value) {
    const key = lagosDateKey(item.startsAt)
    counts[key] = (counts[key] ?? 0) + 1
  }
  return counts
})

/** Selected day lives in the URL (?day=); defaults to today, else the first day with anything on. */
const selectedDay = computed<string>({
  get: () => {
    if (typeof route.query.day === 'string') return route.query.day
    const days = festival.value?.days ?? []
    if (phase.value === 'during' && today.value && dayCounts.value[today.value.date]) return today.value.date
    return days.find((d) => dayCounts.value[d.date])?.date ?? days[0]?.date ?? ''
  },
  set: (value) => router.replace({ query: { ...route.query, day: value } }),
})

const dayItems = computed(() => venueItems.value.filter((item) => lagosDateKey(item.startsAt) === selectedDay.value))
const selectedDayInfo = computed(() => festival.value?.days.find((d) => d.date === selectedDay.value))
const totalSeats = computed(() => venue.value?.screens.reduce((sum, s) => sum + s.capacity, 0) ?? 0)
</script>

<template>
  <div class="space-y-8">
    <AppBackLink fallback="/#venues" label="Back" class="md:hidden" />

    <div v-if="pending || !venue" class="space-y-4" aria-busy="true">
      <UiSkeleton class="h-10 w-2/3" />
      <UiSkeleton class="h-4 w-1/2 rounded-md" />
    </div>

    <template v-else>
      <header>
        <h1 class="font-display text-h1 font-semibold md:text-display">{{ venue.name }}</h1>
        <p class="mt-2 flex items-start gap-2 text-muted">
          <MapPinIcon class="mt-0.5 size-4 shrink-0 text-subtle" aria-hidden="true" />
          {{ venue.address }}
        </p>
        <div class="mt-5 flex flex-wrap gap-2.5">
          <UiButton :to="venue.mapsUrl" target="_blank" rel="noopener noreferrer" external>
            Directions
            <ArrowUpRightIcon aria-hidden="true" />
          </UiButton>
          <UiButton variant="secondary" :to="{ path: '/programme', query: { venue: venue.slug } }">
            Full programme here
          </UiButton>
        </div>
      </header>

      <div class="grid gap-3 md:grid-cols-2 md:gap-4">
        <UiCard>
          <h2 class="flex items-center gap-2 font-semibold">
            <MonitorPlayIcon class="size-4.5 text-muted" aria-hidden="true" />
            <template v-if="venue.screens.length === 1">{{ venue.screens[0]?.name }}</template>
            <template v-else>{{ venue.screens.length }} screens</template>
            <span class="ml-auto text-meta font-normal text-muted tabular-nums">{{ totalSeats.toLocaleString('en-NG') }} seats</span>
          </h2>
          <ul v-if="venue.screens.length > 1" class="mt-2 divide-y divide-line">
            <li v-for="screen in venue.screens" :key="screen.id" class="flex justify-between py-2 text-meta">
              <span>{{ screen.name }}</span>
              <span class="text-muted tabular-nums">{{ screen.capacity }} seats</span>
            </li>
          </ul>
          <p v-else class="mt-2 text-meta text-muted">One screen hosts everything at this venue.</p>
        </UiCard>
        <UiCard>
          <h2 class="flex items-center gap-2 font-semibold">
            <AccessibilityIcon class="size-4.5 text-muted" aria-hidden="true" />
            Accessibility
          </h2>
          <ul class="mt-2 space-y-2 text-meta">
            <li v-for="line in venue.accessibility" :key="line" class="flex gap-2">
              <CheckIcon class="mt-0.5 size-3.5 shrink-0 text-success" aria-hidden="true" />
              {{ line }}
            </li>
          </ul>
        </UiCard>
      </div>

      <section aria-labelledby="whatson-title">
        <UiSectionHeader title="What’s on here" title-id="whatson-title" :meta="`${venueItems.length} listings this festival`" />
        <ProgrammeDayPicker
          v-if="festival"
          v-model="selectedDay"
          class="mb-4"
          :days="festival.days"
          :counts="dayCounts"
          :today="phase === 'during' ? today?.date : null"
        />
        <ul v-if="dayItems.length" class="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <li v-for="item in dayItems" :key="item.id">
            <ProgrammeItemCard :item="item" :now="now" :to="programmeItemLink(item)" saveable />
          </li>
        </ul>
        <UiEmptyState
          v-else
          :icon="SearchXIcon"
          :title="`Nothing here on ${selectedDayInfo?.label ?? 'this day'}`"
          description="Pick another day above."
        />
      </section>
    </template>
  </div>
</template>

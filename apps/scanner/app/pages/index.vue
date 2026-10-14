<script setup lang="ts">
import { LogOutIcon, RefreshCwIcon, SearchXIcon } from 'lucide-vue-next'

useHead({ title: 'Choose a door' })

const { staff, signOut } = useStaff()
const clock = useDoorClock()
const { data: sessions, status, refresh } = useDoorSessions()

const days = computed(() => sessionDays(sessions.value))
const day = useState('door:day', () => '')
watchEffect(() => {
  if (days.value.length && !days.value.includes(day.value)) day.value = defaultDay(days.value, clock.now.value) ?? ''
})

/** A door is usually one venue all day, so the choice is kept on the device. */
const venueIds = useLocalStorage<string[]>('afriff-door:venues', [])
const venues = computed(() => {
  const seen = new Map<string, string>()
  for (const session of sessions.value) seen.set(session.venueId, session.venueName)
  return [...seen].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
})
function toggleVenue(id: string) {
  venueIds.value = venueIds.value.includes(id) ? venueIds.value.filter((item) => item !== id) : [...venueIds.value, id]
}

const search = ref('')
const groups = computed(() =>
  groupSessions(sessions.value, { day: day.value, venueIds: venueIds.value, search: search.value, now: clock.now.value }),
)
const empty = computed(() => !groups.value.open.length && !groups.value.upcoming.length && !groups.value.ended.length)
const loading = computed(() => !sessions.value.length && status.value !== 'error' && status.value !== 'success')
</script>

<template>
  <main id="main" class="mx-auto w-full max-w-xl px-4 pt-safe pb-safe">
    <header class="flex items-center gap-3 py-4">
      <BrandEmblem :size="32" />
      <div class="min-w-0 flex-1">
        <h1 class="font-display text-h2 font-semibold">Choose a door</h1>
        <p class="truncate text-label text-muted">{{ staff?.name }}</p>
      </div>
      <UiButton size="sm" variant="ghost" @click="signOut">
        <LogOutIcon aria-hidden="true" />
        Sign out
      </UiButton>
    </header>

    <div class="space-y-3">
      <RehearsalClock :days="days" />

      <div class="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-0.5" role="group" aria-label="Day">
        <UiChip v-for="item in days" :key="item" :model-value="item === day" @update:model-value="day = item">
          {{ formatDay(`${item}T12:00:00+01:00`) }}
        </UiChip>
      </div>

      <div class="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-0.5" role="group" aria-label="Venue">
        <UiChip :model-value="!venueIds.length" @update:model-value="venueIds = []">All venues</UiChip>
        <UiChip v-for="venue in venues" :key="venue.id" :model-value="venueIds.includes(venue.id)" @update:model-value="toggleVenue(venue.id)">
          {{ venue.name }}
        </UiChip>
      </div>

      <UiSearchInput v-model="search" placeholder="Film, event or screen" label="Search sessions" />
    </div>

    <div v-if="loading" class="mt-6 space-y-2" aria-busy="true">
      <UiSkeleton v-for="index in 5" :key="index" class="h-16 rounded-tile" />
    </div>

    <UiCard v-else-if="status === 'error'" class="mt-6 flex flex-wrap items-center justify-between gap-3">
      <p class="text-meta text-muted">We could not load the programme. Check the connection.</p>
      <UiButton size="sm" variant="secondary" @click="refresh()">
        <RefreshCwIcon aria-hidden="true" />
        Try again
      </UiButton>
    </UiCard>

    <UiEmptyState
      v-else-if="empty"
      class="mt-6"
      :icon="SearchXIcon"
      title="Nothing here"
      description="No screenings or events match that day, venue and search."
    />

    <div v-else class="mt-6 space-y-6 pb-8">
      <section v-if="groups.open.length" aria-labelledby="open-title">
        <UiSectionHeader title="Doors open" title-id="open-title" :meta="String(groups.open.length)" />
        <UiCard :padded="false" class="divide-y divide-line overflow-hidden">
          <SessionRow v-for="session in groups.open" :key="sessionKey(session.ref)" :session="session" state="open" />
        </UiCard>
      </section>

      <section v-if="groups.upcoming.length" aria-labelledby="later-title">
        <UiSectionHeader title="Later" title-id="later-title" :meta="String(groups.upcoming.length)" />
        <UiCard :padded="false" class="divide-y divide-line overflow-hidden">
          <SessionRow v-for="session in groups.upcoming" :key="sessionKey(session.ref)" :session="session" state="upcoming" />
        </UiCard>
      </section>

      <UiDisclosure v-if="groups.ended.length" :title="`Ended (${groups.ended.length})`">
        <UiCard :padded="false" class="divide-y divide-line overflow-hidden">
          <SessionRow v-for="session in groups.ended" :key="sessionKey(session.ref)" :session="session" state="ended" />
        </UiCard>
      </UiDisclosure>
    </div>
  </main>
</template>

<script setup lang="ts">
import { SearchXIcon } from 'lucide-vue-next'

useHead({ title: 'Programme' })

const { data: programme } = useOpsProgramme()

const days = computed(() => [...new Set((programme.value?.screenings ?? []).map((item) => lagosDateKey(item.startsAt)))].sort())
const day = useState('ops:day', () => '')
watchEffect(() => {
  if (days.value.length && !days.value.includes(day.value)) day.value = days.value.find((item) => item >= lagosDateKey(new Date())) ?? days.value[0]!
})
const search = ref('')
const venueId = ref('')

const lookups = computed(() => ({
  film: new Map((programme.value?.films ?? []).map((item) => [item.id, item])),
  venue: new Map((programme.value?.venues ?? []).map((item) => [item.id, item])),
}))
const venueOptions = computed(() => [{ value: '', label: 'All venues' }, ...(programme.value?.venues ?? []).map((item) => ({ value: item.id, label: item.name }))])

const rows = computed(() => {
  const term = search.value.trim().toLowerCase()
  return (programme.value?.screenings ?? [])
    .filter((item) => lagosDateKey(item.startsAt) === day.value)
    .filter((item) => !venueId.value || item.venueId === venueId.value)
    .map((item) => {
      const venue = lookups.value.venue.get(item.venueId)
      return {
        screening: item,
        title: lookups.value.film.get(item.filmId)?.title ?? item.id,
        place: [venue?.shortName, venue?.screens.find((screen) => screen.id === item.screenId)?.name].filter(Boolean).join(', '),
      }
    })
    .filter((row) => !term || `${row.title} ${row.place}`.toLowerCase().includes(term))
})
</script>

<template>
  <div>
    <OpsHeader title="Programme" description="Screenings by day. Open one to move or cancel it, and tell the people it affects." />

    <div class="mb-4 flex flex-wrap items-end gap-3">
      <div class="-mx-1 flex max-w-full gap-1.5 overflow-x-auto px-1 pb-0.5" role="group" aria-label="Day">
        <UiChip v-for="item in days" :key="item" :model-value="item === day" @update:model-value="day = item">
          {{ formatDay(`${item}T12:00:00+01:00`) }}
        </UiChip>
      </div>
      <div class="ml-auto flex w-full flex-wrap gap-3 sm:w-auto">
        <UiSelect v-model="venueId" label="Venue" :options="venueOptions" class="min-w-48 flex-1" />
        <UiSearchInput v-model="search" placeholder="Film or screen" label="Search screenings" class="min-w-56 flex-1 self-end" />
      </div>
    </div>

    <UiSkeleton v-if="!programme" class="h-96 rounded-card" />
    <UiEmptyState v-else-if="!rows.length" :icon="SearchXIcon" title="No screenings match" description="Try another day, venue or search." />
    <UiCard v-else :padded="false" class="overflow-x-auto">
      <table class="ops-table">
        <thead>
          <tr>
            <th scope="col">Time</th>
            <th scope="col">Film</th>
            <th scope="col">Where</th>
            <th scope="col" class="num">Sold</th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.screening.id" class="cursor-pointer transition-colors hover:bg-hover" @click="navigateTo(`/programme/${row.screening.id}`)">
            <td class="font-semibold whitespace-nowrap tabular-nums" :class="row.screening.cancelled && 'text-muted line-through'">{{ formatTime(row.screening.startsAt) }}</td>
            <td>
              <NuxtLink :to="`/programme/${row.screening.id}`" class="font-medium hover:underline" @click.stop>{{ row.title }}</NuxtLink>
              <UiBadge v-if="row.screening.format === 'Gala'" tone="accent" class="ml-1.5">Gala</UiBadge>
            </td>
            <td class="text-muted">{{ row.place }}</td>
            <td class="num whitespace-nowrap">
              {{ row.screening.sold }} / {{ row.screening.capacity }}
              <span class="mt-1 block h-1 w-20 overflow-hidden rounded-full bg-raised ml-auto" aria-hidden="true">
                <span class="block h-full rounded-full bg-accent" :style="{ width: `${Math.min(100, (row.screening.sold / row.screening.capacity) * 100)}%` }" />
              </span>
            </td>
            <td>
              <UiBadge v-if="row.screening.cancelled" tone="danger">Cancelled</UiBadge>
              <UiBadge v-else-if="Date.parse(row.screening.endsAt) < Date.now()">Ended</UiBadge>
              <UiBadge v-else-if="row.screening.sold >= row.screening.capacity" tone="accent">Sold out</UiBadge>
            </td>
          </tr>
        </tbody>
      </table>
    </UiCard>
    <p class="mt-3 text-label text-muted">Events, films and venues are changed in the programme data for now. The seed script loads them.</p>
  </div>
</template>

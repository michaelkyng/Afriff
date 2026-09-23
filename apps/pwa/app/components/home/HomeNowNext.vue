<script setup lang="ts">
import type { FestivalDay } from '@afriff/api'
import type { ProgrammeItem } from '@afriff/api/programme'

/** "Happening now" and "Up next today / Tomorrow / Opening day". */
defineProps<{
  now: Date
  today: FestivalDay | null
  liveItems: ProgrammeItem[]
  upNext: ProgrammeItem[]
  upNextTitle: string
  upNextDay: FestivalDay | null
  pending: boolean
}>()
</script>

<template>
  <div class="space-y-10">
    <section v-if="liveItems.length" aria-labelledby="now-title" class="@container">
      <UiSectionHeader
        title="Happening now"
        title-id="now-title"
        :meta="today ? `Day ${today.number}, ${formatTime(now)}` : undefined"
        to="/programme"
        link-label="Full schedule"
      />
      <ul class="grid gap-3 @lg:grid-cols-2">
        <li v-for="item in liveItems" :key="item.id">
          <ProgrammeItemCard :item="item" :now="now" :to="programmeItemLink(item)" />
        </li>
      </ul>
    </section>

    <section v-if="pending || upNext.length" aria-labelledby="next-title" class="@container">
      <UiSectionHeader
        :title="upNextTitle"
        title-id="next-title"
        :meta="upNextDay?.label"
        :to="upNextDay ? `/programme?day=${upNextDay.date}` : '/programme'"
        link-label="Full schedule"
      />
      <ul class="grid gap-3 @lg:grid-cols-2">
        <template v-if="pending">
          <li v-for="n in 4" :key="n"><UiSkeleton class="h-27 rounded-card" /></li>
        </template>
        <template v-else>
          <li v-for="item in upNext" :key="item.id">
            <ProgrammeItemCard :item="item" :now="now" :to="programmeItemLink(item)" />
          </li>
        </template>
      </ul>
    </section>
  </div>
</template>

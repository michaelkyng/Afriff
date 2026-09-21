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
    <section v-if="liveItems.length" aria-labelledby="now-title">
      <UiSectionHeader
        title="Happening now"
        title-id="now-title"
        :eyebrow="today ? `Day ${today.number} · ${formatTime(now)}` : undefined"
        to="/programme"
        link-label="Full schedule"
      />
      <ul class="grid gap-3 sm:grid-cols-2">
        <li v-for="item in liveItems" :key="item.id">
          <ProgrammeItemCard :item="item" :now="now" :to="programmeItemLink(item)" />
        </li>
      </ul>
    </section>

    <section v-if="pending || upNext.length" aria-labelledby="next-title">
      <UiSectionHeader
        :title="upNextTitle"
        title-id="next-title"
        :eyebrow="upNextDay ? `Day ${upNextDay.number} · ${upNextDay.label}` : undefined"
        :to="upNextDay ? `/programme?day=${upNextDay.date}` : '/programme'"
        link-label="Full schedule"
      />
      <ul class="grid gap-3 sm:grid-cols-2">
        <template v-if="pending">
          <li v-for="n in 4" :key="n"><UiSkeleton class="h-[7.5rem] rounded-card" /></li>
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

<script setup lang="ts">
import type { FestivalDay } from '@afriff/api'

/** Row of festival days. Shows how many slots match the current filters on each day. */
defineProps<{
  days: FestivalDay[]
  counts?: Record<string, number>
  /** Lagos date of "today", to label it. */
  today?: string | null
}>()

const model = defineModel<string>({ required: true })

const weekday = (date: string) => formatDay(`${date}T12:00:00+01:00`).split(' ')[0]
const dayNumber = (date: string) => Number(date.slice(8, 10))
</script>

<template>
  <div role="radiogroup" aria-label="Festival day" class="scrollbar-none flex gap-1.5 overflow-x-auto">
    <button
      v-for="day in days"
      :key="day.date"
      type="button"
      role="radio"
      :aria-checked="model === day.date"
      :aria-label="`${day.label}${day.highlight ? `, ${day.highlight}` : ''}${counts ? `, ${counts[day.date] ?? 0} listings` : ''}${today === day.date ? ', today' : ''}`"
      :title="day.highlight"
      class="pressable flex w-[3.25rem] shrink-0 flex-col items-center rounded-tile border py-1.5"
      :class="
        model === day.date
          ? 'border-transparent bg-ink text-canvas'
          : 'border-line bg-surface text-ink hover:border-line-strong hover:bg-hover'
      "
      @click="model = day.date"
    >
      <span class="text-micro font-medium" :class="model === day.date ? 'opacity-70' : 'text-muted'">
        {{ today === day.date ? 'Today' : weekday(day.date) }}
      </span>
      <span class="text-h3 leading-6 font-semibold tabular-nums">{{ dayNumber(day.date) }}</span>
      <span
        v-if="counts"
        class="text-micro tabular-nums"
        :class="model === day.date ? 'opacity-70' : (counts[day.date] ?? 0) ? 'text-muted' : 'text-subtle'"
      >
        {{ counts[day.date] ?? 0 }}
      </span>
    </button>
  </div>
</template>

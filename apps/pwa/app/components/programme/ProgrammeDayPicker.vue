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
  <div role="radiogroup" aria-label="Festival day" class="scrollbar-none flex gap-2 overflow-x-auto">
    <button
      v-for="day in days"
      :key="day.date"
      type="button"
      role="radio"
      :aria-checked="model === day.date"
      :aria-label="`${day.label}${counts ? `, ${counts[day.date] ?? 0} listings` : ''}${today === day.date ? ', today' : ''}`"
      class="relative flex min-w-[3.75rem] shrink-0 flex-col items-center rounded-2xl border px-2.5 pt-1.5 pb-2 transition-colors"
      :class="
        model === day.date
          ? 'border-transparent bg-ink text-canvas'
          : 'border-line bg-surface text-ink hover:border-line-strong'
      "
      @click="model = day.date"
    >
      <span class="text-[0.6875rem] font-semibold tracking-[0.08em] uppercase" :class="model === day.date ? 'opacity-75' : 'text-muted'">
        {{ today === day.date ? 'Today' : weekday(day.date) }}
      </span>
      <span class="font-display text-2xl leading-tight font-semibold tabular-nums">{{ dayNumber(day.date) }}</span>
      <span
        v-if="counts"
        class="text-[0.6875rem] font-medium tabular-nums"
        :class="model === day.date ? 'opacity-75' : (counts[day.date] ?? 0) ? 'text-muted' : 'text-subtle'"
      >
        {{ counts[day.date] ?? 0 }}
      </span>
      <span
        v-if="day.highlight"
        class="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-accent"
        :title="day.highlight"
        aria-hidden="true"
      />
    </button>
  </div>
</template>

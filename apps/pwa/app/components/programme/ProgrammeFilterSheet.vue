<script setup lang="ts">
import type { Genre, Section, Venue } from '@afriff/api'
import type { FilterGroup } from '~/composables/useProgrammeFilters'

/** Filter panel for the programme. Changes apply immediately; the footer shows the result count. */
const props = defineProps<{
  sections: Section[]
  venues: Venue[]
  genres: Genre[]
  languages: string[]
  resultCount: number
  resultNoun: string
  /** Hide slot-only groups (venue, time) in the films view. */
  filmsOnly?: boolean
}>()

const open = defineModel<boolean>('open', { default: false })
const { has, toggle, clearAll, activeCount } = useProgrammeFilters()

const groups = computed(() => {
  const list: { key: FilterGroup; title: string; options: { value: string; label: string; hue?: number; hint?: string }[] }[] = [
    { key: 'sections', title: 'Section', options: props.sections.map((s) => ({ value: s.slug, label: s.name, hue: s.hue })) },
  ]
  if (!props.filmsOnly) {
    list.push({ key: 'venues', title: 'Venue', options: props.venues.map((v) => ({ value: v.slug, label: v.shortName })) })
    list.push({ key: 'times', title: 'Time of day', options: TIMES_OF_DAY.map((t) => ({ value: t.value, label: t.label, hint: t.hint })) })
  }
  list.push({ key: 'genres', title: 'Genre', options: props.genres.map((g) => ({ value: g, label: g })) })
  list.push({ key: 'languages', title: 'Language', options: props.languages.map((l) => ({ value: l, label: l })) })
  return list
})
</script>

<template>
  <UiSheet v-model:open="open" title="Filters">
    <div class="space-y-6">
      <fieldset v-for="group in groups" :key="group.key">
        <legend class="mb-2.5 text-meta font-semibold text-muted">{{ group.title }}</legend>
        <div class="flex flex-wrap gap-1.5">
          <UiChip
            v-for="option in group.options"
            :key="option.value"
            :model-value="has(group.key, option.value)"
            :title="option.hint"
            @update:model-value="toggle(group.key, option.value)"
          >
            <span
              v-if="option.hue !== undefined"
              class="size-2 rounded-full"
              :style="{ background: `hsl(${option.hue} 70% 55%)` }"
              aria-hidden="true"
            />
            {{ option.label }}
            <span v-if="option.hint" class="text-label tabular-nums opacity-60">{{ option.hint }}</span>
          </UiChip>
        </div>
      </fieldset>
    </div>

    <template #footer>
      <div class="flex items-center justify-between gap-3">
        <UiButton variant="ghost" :disabled="!activeCount" @click="clearAll()">Clear all</UiButton>
        <UiButton @click="open = false">
          Show {{ resultCount }} {{ resultNoun }}
        </UiButton>
      </div>
    </template>
  </UiSheet>
</template>

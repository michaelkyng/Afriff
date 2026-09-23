<script setup lang="ts">
import type { Film, Section } from '@afriff/api'

defineProps<{ sections: { section: Section; filmCount: number; films: Film[] }[]; pending: boolean }>()
</script>

<template>
  <section aria-labelledby="sections-title" class="@container">
    <UiSectionHeader title-id="sections-title" title="Explore by section" to="/programme?view=films" link-label="All films" />
    <ul class="grid grid-cols-2 gap-3 @2xl:grid-cols-3">
      <template v-if="pending">
        <li v-for="n in 3" :key="n"><UiSkeleton class="h-36 rounded-card" /></li>
      </template>
      <template v-else>
        <li v-for="entry in sections" :key="entry.section.id">
          <ProgrammeSectionCard :section="entry.section" :film-count="entry.filmCount" :films="entry.films" />
        </li>
      </template>
    </ul>
  </section>
</template>

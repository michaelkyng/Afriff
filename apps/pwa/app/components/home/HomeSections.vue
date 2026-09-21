<script setup lang="ts">
import type { Section } from '@afriff/api'

defineProps<{ sections: { section: Section; filmCount: number }[]; pending: boolean }>()
</script>

<template>
  <section aria-labelledby="sections-title">
    <UiSectionHeader title-id="sections-title" title="Explore by section" eyebrow="Programme" />
    <ul class="grid grid-cols-2 gap-3 md:grid-cols-3">
      <template v-if="pending">
        <li v-for="n in 3" :key="n"><UiSkeleton class="h-32 rounded-card" /></li>
      </template>
      <template v-else>
        <li v-for="entry in sections" :key="entry.section.id">
          <ProgrammeSectionCard :section="entry.section" :film-count="entry.filmCount" />
        </li>
      </template>
    </ul>
  </section>
</template>

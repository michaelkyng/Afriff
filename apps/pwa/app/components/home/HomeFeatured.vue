<script setup lang="ts">
import type { Film } from '@afriff/api'
import type { ProgrammeLookups } from '@afriff/api/programme'

defineProps<{ films: Film[]; lookups: ProgrammeLookups | null; pending: boolean }>()
</script>

<template>
  <section aria-labelledby="featured-title">
    <UiSectionHeader title-id="featured-title" title="Featured films" eyebrow="Official selection" to="/programme?view=films" />
    <UiCarousel label="Featured films">
      <template v-if="pending">
        <li v-for="n in 5" :key="n" class="w-40 shrink-0 snap-start md:w-44">
          <UiSkeleton class="aspect-[2/3]" />
          <UiSkeleton class="mt-2.5 h-4 w-3/4" />
        </li>
      </template>
      <template v-else>
        <li v-for="film in films" :key="film.id" class="w-40 shrink-0 snap-start md:w-44">
          <FilmCard :film="film" :section="lookups?.section.get(film.sectionId)" show-premiere />
        </li>
      </template>
    </UiCarousel>
  </section>
</template>

<script setup lang="ts">
import type { Film, Section } from '@afriff/api'

/** Poster with title and one line of meta. Used in carousels and grids. */
defineProps<{
  film: Film
  section?: Section
  /** Show the premiere label over the poster. */
  showPremiere?: boolean
  /** Makes the card a link (defaults to the film's detail page). */
  to?: string | false
}>()
</script>

<template>
  <article class="group relative">
    <div
      class="relative overflow-hidden rounded-tile transition-transform duration-200 ease-out group-active:scale-[0.98] group-has-[a:focus-visible]:ring-2 group-has-[a:focus-visible]:ring-accent group-has-[a:focus-visible]:ring-offset-2 group-has-[a:focus-visible]:ring-offset-canvas"
    >
      <FilmPoster
        :film="film"
        :show-text="false"
        class="transition-transform duration-500 ease-out group-hover:scale-[1.03]"
      />
      <span
        v-if="showPremiere && film.premiere"
        class="absolute bottom-2 left-2 z-[3] rounded-tag bg-navy-950/80 px-1.5 py-0.5 text-micro font-medium text-white"
      >
        {{ film.premiere }}
      </span>
    </div>
    <h3 class="mt-2.5 line-clamp-2 text-body font-semibold">
      <NuxtLink
        v-if="to !== false"
        :to="to || `/programme/${film.slug}`"
        class="after:absolute after:inset-0 focus-visible:outline-none"
      >
        {{ film.title }}
      </NuxtLink>
      <template v-else>{{ film.title }}</template>
    </h3>
    <p class="mt-0.5 truncate text-label text-muted">
      {{ formatRuntime(film.runtimeMin) }}<template v-if="section"> · {{ section.name }}</template>
    </p>
  </article>
</template>

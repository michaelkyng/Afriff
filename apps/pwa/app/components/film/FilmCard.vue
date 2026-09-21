<script setup lang="ts">
import type { Film, Section } from '@afriff/api'

/** Poster with title and one line of meta. Used in carousels and grids. */
defineProps<{
  film: Film
  section?: Section
  /** Show the premiere badge over the poster. */
  showPremiere?: boolean
  /** Makes the card a link (defaults to the film's detail page). */
  to?: string | false
}>()
</script>

<template>
  <article class="group relative rounded-xl has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-accent has-[a:focus-visible]:ring-offset-4 has-[a:focus-visible]:ring-offset-canvas">
    <div class="relative">
      <FilmPoster :film="film" :show-text="false" class="transition-transform duration-300 group-hover:-translate-y-1" />
      <span
        v-if="showPremiere && film.premiere"
        class="absolute top-2 left-2 z-[3] rounded-full bg-black/55 px-2 py-0.5 text-[0.625rem] font-semibold tracking-[0.08em] text-white uppercase backdrop-blur"
      >
        {{ film.premiere }}
      </span>
    </div>
    <h3 class="mt-2.5 leading-snug font-semibold">
      <NuxtLink
        v-if="to !== false"
        :to="to || `/programme/${film.slug}`"
        class="after:absolute after:inset-0 focus-visible:outline-none"
      >
        {{ film.title }}
      </NuxtLink>
      <template v-else>{{ film.title }}</template>
    </h3>
    <p class="mt-0.5 text-sm text-muted">
      <template v-if="section">{{ section.name }} · </template>{{ formatRuntime(film.runtimeMin) }}
    </p>
  </article>
</template>

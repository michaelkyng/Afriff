<script setup lang="ts">
import { ArrowUpRightIcon } from 'lucide-vue-next'
import type { Film, Section } from '@afriff/api'

/** A programme section with a peek at its posters. Links to the films view filtered to the section. */
defineProps<{ section: Section; filmCount: number; films?: Film[] }>()
</script>

<template>
  <NuxtLink
    :to="{ path: '/programme', query: { view: 'films', section: section.slug } }"
    class="card card-interactive group flex h-full flex-col p-4"
  >
    <span class="flex items-start justify-between gap-3">
      <span class="text-body font-semibold">{{ section.name }}</span>
      <ArrowUpRightIcon
        class="size-4 shrink-0 text-subtle transition-[color,translate] duration-200 ease-out group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-ink"
        aria-hidden="true"
      />
    </span>
    <span class="mt-0.5 line-clamp-2 text-label text-muted">{{ section.description }}</span>
    <span class="mt-auto flex items-center gap-2.5 pt-4">
      <span v-if="films?.length" class="flex" aria-hidden="true">
        <FilmPoster
          v-for="(film, i) in films.slice(0, 3)"
          :key="film.id"
          :film="film"
          :show-text="false"
          size="sm"
          class="w-6 rounded-[0.3125rem]! ring-2 ring-surface"
          :class="i > 0 && '-ml-2'"
        />
      </span>
      <span class="text-label text-muted tabular-nums">
        {{ filmCount }} {{ filmCount === 1 ? 'film' : 'films' }}
      </span>
    </span>
  </NuxtLink>
</template>

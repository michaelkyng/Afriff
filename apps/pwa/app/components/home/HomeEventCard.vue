<script setup lang="ts">
import { GraduationCapIcon, MessagesSquareIcon, PartyPopperIcon, SparklesIcon, TrophyIcon } from 'lucide-vue-next'
import type { Component } from 'vue'
import type { EventKind } from '@afriff/api'

/** "Don't miss" card for galas, masterclasses, panels and parties. */
defineProps<{
  kind: EventKind
  title: string
  when: string
  where: string
  description: string
  price?: string
  /** Shown when there is no separate ticket, e.g. "Festival Pass holders". */
  access?: string
}>()

const icons: Record<EventKind, Component> = {
  gala: SparklesIcon,
  masterclass: GraduationCapIcon,
  panel: MessagesSquareIcon,
  awards: TrophyIcon,
  social: PartyPopperIcon,
}
const labels: Record<EventKind, string> = {
  gala: 'Gala',
  masterclass: 'Masterclass',
  panel: 'Industry panel',
  awards: 'Awards',
  social: 'Party',
}
</script>

<template>
  <article class="flex h-full flex-col rounded-card border border-line bg-surface p-5">
    <p class="flex items-center gap-2 text-xs font-semibold tracking-[0.12em] text-accent-ink uppercase">
      <component :is="icons[kind]" class="size-4" aria-hidden="true" />
      {{ labels[kind] }}
    </p>
    <h3 class="mt-3 font-display text-xl leading-tight font-semibold">{{ title }}</h3>
    <p class="mt-1 text-sm font-medium">{{ when }}</p>
    <p class="text-sm text-muted">{{ where }}</p>
    <p class="mt-3 line-clamp-3 text-sm text-muted">{{ description }}</p>
    <div class="mt-auto flex items-center justify-between gap-3 pt-5">
      <span class="text-sm font-semibold">{{ price ?? access }}</span>
      <UiButton v-if="price" to="/passes" size="sm">Get tickets</UiButton>
    </div>
  </article>
</template>

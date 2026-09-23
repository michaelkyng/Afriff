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
  <article class="card flex h-full flex-col">
    <div class="flex flex-1 flex-col p-4">
      <div class="flex items-start justify-between gap-3">
        <span class="grid size-10 place-items-center rounded-tile border border-line bg-raised text-ink" aria-hidden="true">
          <component :is="icons[kind]" class="size-5" :stroke-width="1.75" />
        </span>
        <UiBadge>{{ labels[kind] }}</UiBadge>
      </div>
      <h3 class="mt-4 text-h3 font-semibold">{{ title }}</h3>
      <p class="mt-1 text-meta font-medium tabular-nums">{{ when }}</p>
      <p class="text-meta text-muted">{{ where }}</p>
      <p class="mt-2 line-clamp-2 text-meta text-muted">{{ description }}</p>
    </div>
    <div class="flex min-h-14 items-center justify-between gap-3 border-t border-line px-4 py-2.5">
      <span v-if="price" class="font-semibold tabular-nums">{{ price }}</span>
      <span v-else class="text-meta text-muted">{{ access }}</span>
      <UiButton v-if="price" to="/passes" size="sm">Get tickets</UiButton>
    </div>
  </article>
</template>

<script setup lang="ts">
import { GraduationCapIcon, MessagesSquareIcon, PartyPopperIcon, SparklesIcon, TrophyIcon } from 'lucide-vue-next'
import type { Component } from 'vue'
import type { EventKind } from '@afriff/api'
import type { DontMissCard } from '~/composables/useHomeFeed'

/** Festival events: a swipeable row of cards on phones, a compact list in the desktop side rail. */
defineProps<{ cards: DontMissCard[]; layout: 'carousel' | 'list' }>()

const icons: Record<EventKind, Component> = {
  gala: SparklesIcon,
  masterclass: GraduationCapIcon,
  panel: MessagesSquareIcon,
  awards: TrophyIcon,
  social: PartyPopperIcon,
}
</script>

<template>
  <section v-if="cards.length" aria-labelledby="dontmiss-title">
    <UiSectionHeader title-id="dontmiss-title" title="Don’t miss" to="/passes" link-label="Tickets" />

    <UiCarousel v-if="layout === 'carousel'" label="Festival events">
      <li v-for="card in cards" :key="card.key" class="w-72 shrink-0 snap-start">
        <HomeEventCard
          :kind="card.kind"
          :title="card.title"
          :when="card.when"
          :where="card.where"
          :description="card.description"
          :price="card.price"
          :access="card.access"
        />
      </li>
    </UiCarousel>

    <ul v-else class="card divide-y divide-line overflow-hidden">
      <li v-for="card in cards" :key="card.key">
        <NuxtLink :to="card.price ? '/passes' : '/programme'" class="row-interactive flex items-center gap-3 px-3.5 py-3">
          <span class="grid size-9 shrink-0 place-items-center rounded-tile border border-line bg-raised text-ink" aria-hidden="true">
            <component :is="icons[card.kind]" class="size-4.5" :stroke-width="1.75" />
          </span>
          <span class="min-w-0 flex-1">
            <span class="block truncate font-medium">{{ card.title }}</span>
            <span class="block truncate text-meta text-muted tabular-nums">{{ card.when }}</span>
          </span>
          <span class="shrink-0 text-meta font-medium tabular-nums" :class="card.price ? 'text-ink' : 'text-muted'">
            {{ card.price ?? 'Included' }}
          </span>
        </NuxtLink>
      </li>
    </ul>
  </section>
</template>

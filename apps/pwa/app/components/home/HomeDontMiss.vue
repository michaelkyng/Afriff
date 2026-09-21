<script setup lang="ts">
import { ChevronRightIcon, GraduationCapIcon, MessagesSquareIcon, PartyPopperIcon, SparklesIcon, TrophyIcon } from 'lucide-vue-next'
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
    <UiSectionHeader title-id="dontmiss-title" title="Don’t miss" eyebrow="Events" to="/passes" link-label="All tickets" />

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

    <ul v-else class="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
      <li v-for="card in cards" :key="card.key">
        <NuxtLink
          :to="card.price ? '/passes' : '/programme'"
          class="flex items-center gap-3 p-3.5 transition-colors hover:bg-raised/60"
        >
          <span class="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent-ink" aria-hidden="true">
            <component :is="icons[card.kind]" class="size-5" />
          </span>
          <span class="min-w-0 flex-1">
            <span class="block truncate text-sm font-semibold">{{ card.title }}</span>
            <span class="block truncate text-xs text-muted">{{ card.when }}</span>
          </span>
          <span class="shrink-0 text-xs font-semibold" :class="card.price ? 'text-ink' : 'text-muted'">
            {{ card.price ?? 'Included' }}
          </span>
          <ChevronRightIcon class="size-4 shrink-0 text-subtle" aria-hidden="true" />
        </NuxtLink>
      </li>
    </ul>
  </section>
</template>

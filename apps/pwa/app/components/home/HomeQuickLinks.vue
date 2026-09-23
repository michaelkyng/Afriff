<script setup lang="ts">
import type { Component } from 'vue'
import { CalendarDaysIcon, MapPinIcon, TicketCheckIcon, TicketIcon } from 'lucide-vue-next'

/** Shortcuts to the main areas. A row of tiles on phones and tablets, one segmented panel in the desktop rail. */
const props = withDefaults(defineProps<{ fromPrice?: string; venueCount?: number; layout?: 'grid' | 'stack' }>(), {
  layout: 'grid',
})

const links = computed<{ label: string; hint: string; to: string; icon: Component }[]>(() => [
  { label: 'Programme', hint: 'Films and times', to: '/programme', icon: CalendarDaysIcon },
  { label: 'Tickets', hint: props.fromPrice ? `From ${props.fromPrice}` : 'Passes and tickets', to: '/tickets', icon: TicketIcon },
  { label: 'My tickets', hint: 'What you have bought', to: '/tickets?view=mine', icon: TicketCheckIcon },
  { label: 'Venues', hint: props.venueCount ? `${props.venueCount} across Lagos` : 'Getting there', to: '/#venues', icon: MapPinIcon },
])
</script>

<template>
  <nav aria-label="Quick links">
    <ul v-if="layout === 'grid'" class="grid grid-cols-2 gap-2.5 md:grid-cols-4 md:gap-3">
      <li v-for="link in links" :key="link.label">
        <NuxtLink :to="link.to" class="card card-interactive flex items-center gap-3 p-3">
          <span class="grid size-9 shrink-0 place-items-center rounded-tile border border-line bg-raised text-ink" aria-hidden="true">
            <component :is="link.icon" class="size-4.5" :stroke-width="1.75" />
          </span>
          <span class="min-w-0">
            <span class="block leading-tight font-semibold">{{ link.label }}</span>
            <span class="mt-0.5 block truncate text-micro text-muted">{{ link.hint }}</span>
          </span>
        </NuxtLink>
      </li>
    </ul>

    <ul v-else class="grid grid-cols-2 gap-px overflow-hidden rounded-card border border-line bg-line shadow-card">
      <li v-for="link in links" :key="link.label" class="bg-surface">
        <NuxtLink :to="link.to" class="row-interactive flex h-full flex-col gap-3 p-3.5">
          <component :is="link.icon" class="size-5 text-muted" :stroke-width="1.75" aria-hidden="true" />
          <span class="min-w-0">
            <span class="block leading-tight font-semibold">{{ link.label }}</span>
            <span class="mt-0.5 block truncate text-micro text-muted">{{ link.hint }}</span>
          </span>
        </NuxtLink>
      </li>
    </ul>
  </nav>
</template>

<script setup lang="ts">
import type { Component } from 'vue'
import { CalendarDaysIcon, MapPinIcon, TicketIcon, WalletCardsIcon } from 'lucide-vue-next'

const props = withDefaults(defineProps<{ fromPrice?: string; venueCount?: number; layout?: 'grid' | 'stack' }>(), {
  layout: 'grid',
})

const links = computed<{ label: string; hint: string; to: string; icon: Component }[]>(() => [
  { label: 'Programme', hint: 'Films & times', to: '/programme', icon: CalendarDaysIcon },
  { label: 'Passes', hint: props.fromPrice ? `From ${props.fromPrice}` : 'Passes & tickets', to: '/passes', icon: TicketIcon },
  { label: 'My tickets', hint: 'Work offline', to: '/wallet', icon: WalletCardsIcon },
  { label: 'Venues', hint: props.venueCount ? `${props.venueCount} across Lagos` : 'Getting there', to: '/#venues', icon: MapPinIcon },
])
</script>

<template>
  <nav aria-label="Quick links">
    <ul class="grid gap-3" :class="layout === 'grid' ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-2'">
      <li v-for="link in links" :key="link.label">
        <NuxtLink
          :to="link.to"
          class="flex items-center gap-3 rounded-card border border-line bg-surface p-3.5 transition-colors hover:border-line-strong"
        >
          <span class="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent-ink" aria-hidden="true">
            <component :is="link.icon" class="size-5" />
          </span>
          <span class="min-w-0">
            <span class="block leading-tight font-semibold">{{ link.label }}</span>
            <span class="block truncate text-xs text-muted">{{ link.hint }}</span>
          </span>
        </NuxtLink>
      </li>
    </ul>
  </nav>
</template>

<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'

/** One number on the overview, with what it counts. Linked when there is somewhere to act on it. */
defineProps<{ label: string; value: string | number; hint?: string; to?: RouteLocationRaw; attention?: boolean }>()
const Link = resolveComponent('NuxtLink')
</script>

<template>
  <component :is="to ? Link : 'div'" :to="to" class="card block p-4" :class="[to && 'card-interactive', attention && 'border-accent/45']">
    <p class="text-label text-muted">{{ label }}</p>
    <p class="mt-1 font-display text-h1 font-semibold tabular-nums" :class="attention && 'text-accent-ink'">{{ value }}</p>
    <p v-if="hint" class="mt-0.5 text-label text-muted">{{ hint }}</p>
  </component>
</template>

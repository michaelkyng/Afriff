<script setup lang="ts">
import { ArrowUpRightIcon } from 'lucide-vue-next'
import type { Section } from '@afriff/api'

defineProps<{ section: Section; filmCount: number }>()
</script>

<template>
  <NuxtLink
    :to="{ path: '/programme', query: { view: 'films', section: section.slug } }"
    class="group relative flex h-full flex-col overflow-hidden rounded-card border border-line bg-surface p-4 transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-line-strong"
  >
    <span
      class="absolute inset-x-0 top-0 h-1"
      :style="{ background: `hsl(${section.hue} 70% 55%)` }"
      aria-hidden="true"
    />
    <span class="flex items-start justify-between gap-2">
      <span class="font-display text-lg leading-tight font-semibold">{{ section.name }}</span>
      <ArrowUpRightIcon
        class="size-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
        aria-hidden="true"
      />
    </span>
    <span class="mt-1.5 line-clamp-2 text-sm text-muted">{{ section.description }}</span>
    <span class="mt-auto pt-3 text-xs font-semibold text-accent-ink">
      {{ filmCount }} {{ filmCount === 1 ? 'film' : 'films' }}
    </span>
  </NuxtLink>
</template>

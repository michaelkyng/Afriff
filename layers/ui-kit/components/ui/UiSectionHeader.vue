<script setup lang="ts">
import { ArrowRightIcon } from 'lucide-vue-next'

defineProps<{
  title: string
  /** id for the heading, so a <section aria-labelledby> can point at it. */
  titleId?: string
  eyebrow?: string
  /** Optional "See all" link. */
  to?: string
  linkLabel?: string
}>()
</script>

<template>
  <div class="mb-4 flex items-end justify-between gap-4">
    <div>
      <p v-if="eyebrow" class="mb-1 text-xs font-semibold tracking-[0.14em] text-accent-ink uppercase">{{ eyebrow }}</p>
      <h2 :id="titleId" class="font-display text-2xl font-semibold tracking-tight md:text-3xl">{{ title }}</h2>
    </div>
    <NuxtLink
      v-if="to"
      :to="to"
      class="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-accent-ink hover:underline"
    >
      {{ linkLabel ?? 'See all' }}
      <ArrowRightIcon class="size-4" aria-hidden="true" />
    </NuxtLink>
  </div>
</template>

<script setup lang="ts">
import type { Film, PosterMotif } from '@afriff/api'

/**
 * Generated poster art: a deterministic, offline-friendly stand-in for real key art.
 * When the backend serves poster images, add an `imageUrl` branch here.
 */
const props = withDefaults(
  defineProps<{
    film: Pick<Film, 'title' | 'director' | 'poster'>
    size?: 'sm' | 'md' | 'lg'
    /** Show title and director on the art. */
    showText?: boolean
  }>(),
  { size: 'md', showText: true },
)

const background = computed(() => {
  const { hue, hue2, motif } = props.film.poster
  const c1 = `hsl(${hue} 62% 42%)`
  const c2 = `hsl(${hue2} 72% 58%)`
  const c2a = (alpha: number) => `hsl(${hue2} 72% 58% / ${alpha})`
  const dark = `hsl(${hue} 55% 11%)`

  const motifs: Record<PosterMotif, string> = {
    sun: [
      `linear-gradient(to top, ${dark} 0 24%, transparent 24.2%)`,
      `radial-gradient(circle at 50% 76%, ${c2} 0 17%, transparent 17.4%)`,
      `linear-gradient(180deg, ${dark} 0%, ${c1} 62%, ${c2} 100%)`,
    ].join(','),
    rays: [
      `repeating-conic-gradient(from 180deg at 50% 108%, ${c2a(0.55)} 0deg 5deg, transparent 5deg 13deg)`,
      `linear-gradient(180deg, ${dark} 10%, ${c1} 100%)`,
    ].join(','),
    bands: [
      `repeating-linear-gradient(112deg, ${c1} 0 16px, ${c2} 16px 22px, ${dark} 22px 42px)`,
    ].join(','),
    orb: [
      `radial-gradient(circle at 32% 30%, ${c2} 0, transparent 42%)`,
      `radial-gradient(circle at 78% 72%, ${c1} 0, transparent 55%)`,
      `linear-gradient(${dark}, ${dark})`,
    ].join(','),
    grid: [
      `linear-gradient(${c2a(0.22)} 1px, transparent 1px) 0 0 / 20px 20px`,
      `linear-gradient(90deg, ${c2a(0.22)} 1px, transparent 1px) 0 0 / 20px 20px`,
      `radial-gradient(circle at 70% 24%, ${c1} 0, ${dark} 72%)`,
    ].join(','),
    waves: [
      `linear-gradient(180deg, ${c2a(0.55)} 0%, transparent 55%)`,
      `repeating-radial-gradient(circle at 50% 125%, ${c1} 0 9px, ${dark} 9px 21px)`,
    ].join(','),
  }

  return motifs[motif]
})

const titleSize = computed(
  () => ({ sm: 'text-sm leading-tight', md: 'text-lg leading-tight', lg: 'text-3xl leading-[1.05]' })[props.size],
)
</script>

<template>
  <div
    class="grain relative aspect-[2/3] overflow-hidden rounded-xl bg-navy-900 text-white shadow-lift"
    :style="{ background }"
    role="img"
    :aria-label="`Poster art for ${film.title}`"
  >
    <div
      v-if="showText"
      class="absolute inset-0 z-[2] flex flex-col justify-end bg-gradient-to-t from-black/75 via-black/15 to-transparent"
      :class="size === 'lg' ? 'p-5' : 'p-3'"
    >
      <p
        class="font-display font-semibold tracking-tight text-balance drop-shadow-sm"
        :class="titleSize"
      >
        {{ film.title }}
      </p>
      <p v-if="size !== 'sm'" class="mt-1 text-[0.6875rem] font-medium tracking-[0.12em] text-white/70 uppercase">
        {{ film.director }}
      </p>
    </div>
  </div>
</template>

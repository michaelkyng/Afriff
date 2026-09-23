<script setup lang="ts">
import { onMounted, ref, useTemplateRef } from 'vue'
import { useMutationObserver, useResizeObserver, useScroll } from '@vueuse/core'
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-vue-next'

/**
 * Horizontal, swipeable row with scroll-snap. Arrow buttons appear on larger screens.
 * Put <li> children in the default slot.
 */
defineProps<{ label: string }>()

const track = useTemplateRef<HTMLUListElement>('track')
const { arrivedState, measure: measureScroll } = useScroll(track)

// Only show arrows when the row actually overflows (content arrives after data loads).
const canScroll = ref(false)
function measure() {
  const el = track.value
  canScroll.value = Boolean(el && el.scrollWidth > el.clientWidth + 4)
  measureScroll() // refresh arrivedState when content or size changes without a scroll
}
useResizeObserver(track, measure)
useMutationObserver(track, measure, { childList: true, subtree: true })
onMounted(measure)

function page(direction: 1 | -1) {
  const el = track.value
  if (!el) return
  el.scrollBy({ left: direction * el.clientWidth * 0.85, behavior: 'smooth' })
}
</script>

<template>
  <div class="relative">
    <ul
      ref="track"
      :aria-label="label"
      class="scrollbar-none -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:scroll-px-0 md:gap-4 md:px-0"
    >
      <slot />
    </ul>
    <template v-if="canScroll">
      <button
        type="button"
        class="pressable absolute top-[38%] -left-3 hidden size-9 -translate-y-1/2 place-items-center rounded-full border border-line bg-surface text-ink shadow-pop hover:bg-raised md:grid"
        :class="arrivedState.left ? 'pointer-events-none opacity-0' : 'opacity-100'"
        aria-label="Scroll back"
        @click="page(-1)"
      >
        <ChevronLeftIcon class="size-4.5" />
      </button>
      <button
        type="button"
        class="pressable absolute top-[38%] -right-3 hidden size-9 -translate-y-1/2 place-items-center rounded-full border border-line bg-surface text-ink shadow-pop hover:bg-raised md:grid"
        :class="arrivedState.right ? 'pointer-events-none opacity-0' : 'opacity-100'"
        aria-label="Scroll forward"
        @click="page(1)"
      >
        <ChevronRightIcon class="size-4.5" />
      </button>
    </template>
  </div>
</template>

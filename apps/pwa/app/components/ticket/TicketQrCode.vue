<script setup lang="ts">
import { encodeQr, qrPath } from '@afriff/api/qr'

/**
 * The entry code, drawn as a QR.
 *
 * Always dark on white, whatever the theme: a scanner needs the contrast, and a
 * phone at the door is often held at an angle under bad light. Level Q takes a
 * fingerprint or a crack across the screen without giving up.
 */
const props = withDefaults(defineProps<{ value: string; label?: string; dimmed?: boolean }>(), {
  label: 'Entry code',
})

const code = computed(() => {
  try {
    return encodeQr(props.value, { level: 'Q' })
  }
  catch {
    return null
  }
})

const drawing = computed(() => (code.value ? qrPath(code.value, 3) : null))
</script>

<template>
  <div
    class="grid aspect-square w-full place-items-center rounded-tile bg-white p-3 transition-opacity duration-200 ease-out"
    :class="dimmed && 'opacity-35'"
  >
    <svg
      v-if="drawing"
      :viewBox="`0 0 ${drawing.extent} ${drawing.extent}`"
      class="h-full w-full"
      shape-rendering="crispEdges"
      role="img"
      :aria-label="label"
    >
      <path :d="drawing.path" fill="#0A1042" />
    </svg>
    <p v-else class="px-4 text-center text-meta text-[#0A1042]">This code could not be drawn.</p>
  </div>
</template>

<script setup lang="ts">
/** A toggleable filter chip. Use v-model for the pressed state. */
const pressed = defineModel<boolean>({ default: false })
</script>

<template>
  <button
    type="button"
    :aria-pressed="pressed"
    class="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors [&_svg]:size-4"
    :class="pressed ? 'border-transparent bg-ink text-canvas' : 'border-line bg-surface text-ink hover:border-line-strong'"
    @click="pressed = !pressed"
  >
    <slot />
  </button>
</template>

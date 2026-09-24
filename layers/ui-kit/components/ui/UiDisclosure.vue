<script setup lang="ts">
import { ChevronDownIcon } from 'lucide-vue-next'

/**
 * A question that opens.
 *
 * Built on native `<details>`, so it works with a keyboard, with a screen
 * reader and with the browser's own find-in-page — none of which a hand-rolled
 * accordion gets for free.
 */
withDefaults(defineProps<{ title: string; open?: boolean }>(), { open: false })
</script>

<template>
  <details class="ui-disclosure group border-b border-line last:border-b-0" :open="open">
    <summary
      class="row-interactive flex cursor-pointer list-none items-center gap-3 px-4 py-3.5 font-medium select-none md:px-5 [&::-webkit-details-marker]:hidden"
    >
      <span class="min-w-0 flex-1">{{ title }}</span>
      <ChevronDownIcon
        class="size-4 shrink-0 text-subtle transition-transform duration-200 ease-out group-open:rotate-180"
        aria-hidden="true"
      />
    </summary>
    <div class="px-4 pb-4 text-meta text-muted md:px-5">
      <slot />
    </div>
  </details>
</template>

<style scoped>
/* Only the opening is animated; closing should feel instant. */
@media (prefers-reduced-motion: no-preference) {
  .ui-disclosure[open] > div {
    animation: ui-disclosure-in 180ms var(--ease-out, ease-out);
  }
}

@keyframes ui-disclosure-in {
  from {
    opacity: 0;
    transform: translateY(-2px);
  }
}
</style>

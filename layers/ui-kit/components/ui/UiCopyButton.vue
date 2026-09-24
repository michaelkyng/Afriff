<script setup lang="ts">
import { useClipboard } from '@vueuse/core'
import { CheckIcon, CopyIcon } from 'lucide-vue-next'

/**
 * Icon button that copies a value to the clipboard. The icon turns into a tick for a
 * moment and screen readers hear "{label} copied". Text on touch devices can't be
 * long-pressed to select, so anything worth copying gets one of these.
 */
defineProps<{
  value: string
  /** What gets copied, lower case: the button reads "Copy {label}". */
  label: string
}>()

// `legacy` falls back to execCommand where the Clipboard API is missing (plain http on a LAN).
const { copy, copied } = useClipboard({ copiedDuring: 2000, legacy: true })
</script>

<template>
  <span class="inline-flex shrink-0 align-middle">
    <button
      type="button"
      class="pressable relative grid size-8 place-items-center rounded-full after:absolute after:-inset-1.5 hover:bg-hover"
      :class="copied ? 'text-success' : 'text-muted hover:text-ink'"
      :aria-label="`Copy ${label}`"
      @click="copy(value)"
    >
      <CheckIcon v-if="copied" class="size-4" aria-hidden="true" />
      <CopyIcon v-else class="size-4" aria-hidden="true" />
    </button>
    <span class="sr-only" aria-live="polite">{{ copied ? `${label} copied` : '' }}</span>
  </span>
</template>

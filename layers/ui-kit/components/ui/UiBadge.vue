<script setup lang="ts">
type Tone = 'neutral' | 'accent' | 'success' | 'danger' | 'info'

/** Small static tag for status and attributes. Interactive filters use UiChip instead. */
withDefaults(defineProps<{ tone?: Tone }>(), { tone: 'neutral' })

const tones: Record<Tone, string> = {
  neutral: 'bg-raised text-muted',
  accent: 'bg-accent-soft text-accent-ink',
  success: 'bg-success-soft text-success',
  danger: 'bg-danger-soft text-danger',
  info: 'bg-info-soft text-info',
}
</script>

<template>
  <span
    class="inline-flex h-5 items-center gap-1 rounded-tag px-1.5 text-label font-medium whitespace-nowrap [&_svg]:size-3"
    :class="tones[tone]"
  >
    <slot />
  </span>
</template>

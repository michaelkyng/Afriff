<script setup lang="ts">
withDefaults(
  defineProps<{
    as?: string
    padded?: boolean
    interactive?: boolean
  }>(),
  { as: 'div', padded: true },
)
</script>

<template>
  <component
    :is="as"
    class="rounded-card border border-line bg-surface"
    :class="[
      padded && 'p-5',
      interactive && 'transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-line-strong',
    ]"
  >
    <slot />
  </component>
</template>

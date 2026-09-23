<script setup lang="ts">
/** Surface with a hairline border. `interactive` adds hover and press feedback for clickable cards. */
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
  <component :is="as" class="card" :class="[padded && 'p-4 md:p-5', interactive && 'card-interactive']">
    <slot />
  </component>
</template>

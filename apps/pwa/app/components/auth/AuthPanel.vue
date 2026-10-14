<script setup lang="ts">
/**
 * The frame every account screen shares: the emblem, a title and the line under
 * it, then the form in a card. `before` sits above the emblem (a back link),
 * `after` below the card (links to the other screens).
 */
defineProps<{ title: string; description?: string }>()
</script>

<template>
  <div class="mx-auto flex w-full max-w-sm flex-col py-4 md:min-h-[calc(100dvh-14rem)] md:justify-center md:py-8">
    <slot name="before" />
    <div class="mb-6 md:mb-7">
      <BrandEmblem :size="44" class="mb-4" />
      <h1 class="font-display text-h1 font-semibold text-balance">{{ title }}</h1>
      <p v-if="description || $slots.description" class="mt-1.5 text-pretty text-muted">
        <slot name="description">{{ description }}</slot>
      </p>
    </div>

    <UiCard>
      <slot />
    </UiCard>

    <slot name="after" />
  </div>
</template>

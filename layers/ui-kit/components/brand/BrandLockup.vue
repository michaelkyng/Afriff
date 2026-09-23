<script setup lang="ts">
import BrandEmblem from './BrandEmblem.vue'
import BrandWordmark from './BrandWordmark.vue'
import BrandSubline from './BrandSubline.vue'
/** Stacked logo: emblem, AFRIFF wordmark and the festival name — as on afriff.com. */
withDefaults(defineProps<{ emblemSize?: number }>(), { emblemSize: 72 })
</script>

<template>
  <div class="inline-flex flex-col items-center gap-3" role="img" aria-label="AFRIFF, Africa International Film Festival">
    <BrandEmblem :size="emblemSize" />
    <BrandWordmark class="h-auto w-44" aria-hidden="true" />
    <BrandSubline class="-mt-1 h-auto w-44" aria-hidden="true" />
  </div>
</template>

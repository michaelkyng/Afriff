<script setup lang="ts">
import { MailCheckIcon } from 'lucide-vue-next'

/**
 * Mock mode only: no email leaves the local build, so the link an email would
 * have carried is offered on screen instead, and the flow can be finished.
 */
defineProps<{ actionLabel: string }>()
const emit = defineEmits<{ action: [] }>()
</script>

<template>
  <div class="rounded-tile border border-line bg-raised px-3.5 py-3">
    <p class="flex items-center gap-2 text-meta font-medium">
      <MailCheckIcon class="size-4 text-info" aria-hidden="true" />
      Demo mode: no email is sent
    </p>
    <p class="mt-1 text-meta text-pretty text-muted">
      <slot />
    </p>
    <UiButton variant="secondary" size="sm" class="mt-2.5" @click="emit('action')">{{ actionLabel }}</UiButton>
  </div>
</template>

<script setup lang="ts">
import { BellIcon } from 'lucide-vue-next'

const open = ref(false)
</script>

<template>
  <button
    type="button"
    aria-label="Notifications"
    aria-haspopup="dialog"
    :aria-expanded="open"
    title="Notifications"
    class="pressable grid size-11 shrink-0 place-items-center rounded-full text-ink transition-colors hover:bg-hover"
    @click="open = true"
  >
    <BellIcon class="size-5" :stroke-width="1.75" aria-hidden="true" />
  </button>

  <UiSheet v-model:open="open" title="Notifications">
    <div class="flex flex-col items-center px-4 py-10 text-center">
      <span class="mb-4 grid size-12 place-items-center rounded-full bg-raised text-muted">
        <BellIcon class="size-6" :stroke-width="1.5" aria-hidden="true" />
      </span>
      <p class="font-semibold">No notifications yet</p>
      <p class="mt-1 max-w-xs text-meta text-muted">Festival updates will appear here.</p>
    </div>
  </UiSheet>
</template>

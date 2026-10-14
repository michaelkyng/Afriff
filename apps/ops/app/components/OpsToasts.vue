<script setup lang="ts">
import { CheckIcon, XIcon } from 'lucide-vue-next'

const { toasts, dismiss } = useToast()
</script>

<template>
  <div class="pointer-events-none fixed right-4 bottom-4 z-[70] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2" role="status" aria-live="polite">
    <TransitionGroup
      enter-active-class="transition duration-200 ease-out motion-reduce:transition-none"
      enter-from-class="opacity-0 translate-y-2"
      leave-active-class="transition duration-150 ease-out motion-reduce:transition-none"
      leave-to-class="opacity-0"
    >
      <div v-for="toast in toasts" :key="toast.id" class="pointer-events-auto flex items-start gap-3 rounded-tile border border-line bg-surface px-3.5 py-3 shadow-pop">
        <CheckIcon class="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
        <p class="min-w-0 flex-1 text-meta">{{ toast.text }}</p>
        <button type="button" class="pressable -m-1 grid size-6 place-items-center rounded-full text-muted hover:text-ink" aria-label="Dismiss" @click="dismiss(toast.id)">
          <XIcon class="size-3.5" aria-hidden="true" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>

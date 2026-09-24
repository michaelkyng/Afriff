<script setup lang="ts">
import { TriangleAlertIcon, XIcon } from 'lucide-vue-next'

/**
 * The one case worth interrupting someone for: an urgent change to something
 * they hold a ticket for, or saved. Only the newest shows, waving it away marks
 * it seen on this device, and opening it reads it properly.
 */
const route = useRoute()
const { urgent, inbox } = useUpdates()
/** Nothing to interrupt on the page that lists them all. */
const current = computed(() => (route.path === '/updates' ? undefined : urgent.value[0]))
</script>

<template>
  <Transition
    enter-active-class="transition-[opacity,transform] duration-200 ease-out"
    enter-from-class="opacity-0 -translate-y-1"
    leave-active-class="transition-opacity duration-150 ease-out"
    leave-to-class="opacity-0"
  >
    <div v-if="current" role="status" class="border-b border-danger/30 bg-danger-soft text-danger">
      <div class="mx-auto flex w-full max-w-6xl items-start gap-3 px-4 py-2.5 md:px-8">
        <TriangleAlertIcon class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <p class="min-w-0 flex-1 text-meta">
          <span class="font-semibold">{{ current.title }}</span>
          <span class="text-danger/80"> · {{ current.body }}</span>
          <NuxtLink
            to="/updates"
            class="ml-1 font-medium underline decoration-current/40 hover:decoration-current"
            @click="inbox.markRead(current.id)"
          >
            Updates
          </NuxtLink>
        </p>
        <button
          type="button"
          class="pressable -m-1 grid size-7 shrink-0 place-items-center rounded-full hover:bg-danger/10"
          aria-label="Dismiss this notice"
          @click="inbox.dismiss(current.id)"
        >
          <XIcon class="size-4" />
        </button>
      </div>
    </div>
  </Transition>
</template>

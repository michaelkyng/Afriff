<script setup lang="ts">
import { BellIcon } from 'lucide-vue-next'

/** The bell in the header and top bar: a way into Updates, carrying the unread count. */
const route = useRoute()
const { unread } = useUpdates()

const label = computed(() => (unread.value ? `Updates, ${unread.value} unread` : 'Updates'))
</script>

<template>
  <NuxtLink
    to="/updates"
    :aria-label="label"
    :title="label"
    :aria-current="route.path === '/updates' ? 'page' : undefined"
    class="pressable relative grid size-11 shrink-0 place-items-center rounded-full text-ink transition-colors hover:bg-hover"
  >
    <BellIcon class="size-5" :stroke-width="1.75" aria-hidden="true" />
    <span
      v-if="unread"
      class="absolute top-1.5 right-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[0.625rem] font-semibold text-on-accent tabular-nums"
      aria-hidden="true"
    >
      {{ unread > 9 ? '9+' : unread }}
    </span>
  </NuxtLink>
</template>

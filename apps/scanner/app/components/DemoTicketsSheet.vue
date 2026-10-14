<script setup lang="ts">
import { ChevronRightIcon } from 'lucide-vue-next'
import type { DemoTicket } from '@afriff/api/mock/door'

/** Mock mode: tickets to try at this session, one of each kind a door meets. Tapping one scans it. */
defineProps<{ tickets: DemoTicket[] }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ scan: [payload: string] }>()

function choose(ticket: DemoTicket) {
  open.value = false
  emit('scan', ticket.scan)
}
</script>

<template>
  <UiSheet v-model:open="open" title="Demo tickets">
    <p class="mb-3 text-meta text-pretty text-muted">
      The demo door has no real tickets, so these stand in. Each one goes through the same rules a real scan does.
    </p>
    <ul class="divide-y divide-line overflow-hidden rounded-tile border border-line">
      <li v-for="ticket in tickets" :key="ticket.scan">
        <button type="button" class="row-interactive flex w-full items-center gap-3 px-3.5 py-3 text-left" @click="choose(ticket)">
          <span class="min-w-0 flex-1">
            <span class="block font-semibold">{{ ticket.label }}</span>
            <span v-if="ticket.holderName" class="block text-label text-muted">{{ ticket.holderName }}</span>
          </span>
          <ChevronRightIcon class="size-4 shrink-0 text-subtle" aria-hidden="true" />
        </button>
      </li>
    </ul>
  </UiSheet>
</template>

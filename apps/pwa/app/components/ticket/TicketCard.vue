<script setup lang="ts">
import { ChevronRightIcon, QrCodeIcon } from 'lucide-vue-next'
import { ticketState } from '@afriff/api/tickets'
import type { Ticket } from '@afriff/api'

/** One admission the attendee owns. Opens the ticket itself, where the code is. */
const props = defineProps<{ ticket: Ticket; now?: Date }>()

const state = computed(() => ticketState(props.ticket, props.now))
const spent = computed(() => state.value !== 'valid')

const note = computed(() => {
  switch (state.value) {
    case 'used': return 'Used'
    case 'transferred': return `Passed to ${props.ticket.transfer?.toName ?? props.ticket.transfer?.toEmail ?? 'someone else'}`
    case 'expired': return 'Past'
    case 'void': return 'Cancelled'
    default: return 'Show at the door'
  }
})
</script>

<template>
  <NuxtLink :to="`/tickets/${ticket.id}`" class="card card-interactive block overflow-hidden" :class="spent && 'opacity-70'">
    <div class="flex items-start justify-between gap-3 p-4 md:p-5">
      <div class="min-w-0">
        <p v-if="ticket.productName !== ticket.title" class="text-label text-muted">{{ ticket.productName }}</p>
        <h3 class="mt-0.5 text-body font-semibold">{{ ticket.title }}</h3>
        <p v-if="ticket.subtitle" class="mt-0.5 text-label text-muted tabular-nums">{{ ticket.subtitle }}</p>
        <p class="mt-1.5 text-micro text-muted">{{ ticket.holderName }}</p>
      </div>
      <div
        class="grid size-14 shrink-0 place-items-center rounded-tile border border-line bg-raised text-subtle"
        aria-hidden="true"
      >
        <QrCodeIcon class="size-6" />
      </div>
    </div>
    <p class="flex items-center justify-between gap-3 border-t border-line bg-raised/40 px-4 py-2.5 text-meta md:px-5">
      <span class="font-semibold tracking-[0.08em] tabular-nums" :class="spent && 'line-through decoration-line-strong'">
        {{ ticket.code }}
      </span>
      <span class="flex items-center gap-0.5 text-muted">
        {{ note }}
        <ChevronRightIcon class="size-4" aria-hidden="true" />
      </span>
    </p>
  </NuxtLink>
</template>

<script setup lang="ts">
import { QrCodeIcon } from 'lucide-vue-next'
import type { Ticket } from '@afriff/api'

/** One admission the attendee owns. Entry codes are shown here; scanning comes with the scanner app. */
defineProps<{ ticket: Ticket; past?: boolean }>()
</script>

<template>
  <article class="card overflow-hidden" :class="past && 'opacity-70'">
    <div class="flex items-start justify-between gap-3 p-4 md:p-5">
      <div class="min-w-0">
        <p v-if="ticket.productName !== ticket.title" class="text-meta text-muted">{{ ticket.productName }}</p>
        <h3 class="mt-0.5 text-h3 leading-snug font-semibold">{{ ticket.title }}</h3>
        <p v-if="ticket.subtitle" class="mt-1 text-meta text-muted tabular-nums">{{ ticket.subtitle }}</p>
        <p class="mt-2 text-meta text-muted">{{ ticket.holderName }}</p>
      </div>
      <div class="grid size-14 shrink-0 place-items-center rounded-tile border border-line bg-raised text-subtle" aria-hidden="true">
        <QrCodeIcon class="size-6" />
      </div>
    </div>
    <p class="flex items-center justify-between gap-3 border-t border-line bg-raised/40 px-4 py-2.5 text-meta md:px-5">
      <span class="font-semibold tracking-[0.08em] tabular-nums">{{ ticket.code }}</span>
      <span class="text-muted">{{ past ? 'Used or past' : 'Show at the door' }}</span>
    </p>
  </article>
</template>

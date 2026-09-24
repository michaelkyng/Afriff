<script setup lang="ts">
import {
  ArrowLeftIcon,
  CalendarPlusIcon,
  CheckIcon,
  ClockIcon,
  MapPinIcon,
  ReceiptTextIcon,
  SendIcon,
  SunIcon,
  UserRoundIcon,
} from 'lucide-vue-next'
import { ticketIcs, ticketIcsFilename, ticketPayload, ticketState } from '@afriff/api/tickets'
import type { Ticket, TicketStatus } from '@afriff/api'

/**
 * One ticket, at the door.
 *
 * Everything on this screen comes from the ticket itself, so it holds up with
 * the phone in airplane mode: the code, what it admits to, and the calendar file
 * are all built here rather than fetched.
 */

const route = useRoute()
const api = useApi()
const { data: festival } = useFestival()
const { now } = useFestivalClock(festival)
const id = String(route.params.id)

const { data: ticket, status, error: loadError, refresh } = useLazyAsyncData(`ticket:${id}`, () => api.tickets.get(id))
/** A lazy fetch reports idle before pending, so success or error is what settles it. */
const loading = computed(() => status.value !== 'success' && status.value !== 'error')

useHead({ title: () => ticket.value?.title ?? 'Ticket' })
usePageCrumb(() => ticket.value?.title)

watchEffect(() => {
  if (loadError.value) showError({ statusCode: 404, statusMessage: 'Ticket not found' })
})

const state = computed(() => (ticket.value ? ticketState(ticket.value, now.value) : 'valid'))
const admits = computed(() => state.value === 'valid')

type Tone = 'neutral' | 'success' | 'danger'
const statusLine: Record<TicketStatus | 'expired', { label: string; tone: Tone; note: string }> = {
  valid: { label: 'Valid', tone: 'success', note: 'Show this at the door. Staff scan the code.' },
  used: { label: 'Used', tone: 'neutral', note: 'This ticket has already been scanned.' },
  expired: { label: 'Past', tone: 'neutral', note: 'This screening is over.' },
  transferred: { label: 'Passed on', tone: 'neutral', note: 'You gave this ticket to someone else.' },
  void: { label: 'Cancelled', tone: 'danger', note: 'This ticket was cancelled.' },
}
const current = computed(() => statusLine[state.value])

const payload = computed(() => (ticket.value ? ticketPayload(ticket.value) : ''))

/** Splits the printed code so it can be read out loud without losing a character. */
const codeGroups = computed(() => ticket.value?.code.split('-') ?? [])

// ------------------------------------------------------------------ calendar

function addToCalendar() {
  const value = ticket.value
  if (!value) return
  const ics = ticketIcs(value, new Date())
  if (!ics) return
  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = ticketIcsFilename(value)
  link.click()
  URL.revokeObjectURL(url)
}

// ------------------------------------------------------------------ transfer

const transferOpen = ref(false)
const justTransferred = ref(false)

function onTransferred(updated: Ticket) {
  ticket.value = updated
  justTransferred.value = true
  refresh()
  // My tickets is cached under its own key, and one of them just changed hands.
  refreshNuxtData('tickets:mine')
}
</script>

<template>
  <div class="mx-auto max-w-lg space-y-5">
    <UiButton to="/tickets?view=mine" variant="ghost" size="sm" class="-ml-2">
      <ArrowLeftIcon aria-hidden="true" />
      My tickets
    </UiButton>

    <template v-if="loading">
      <UiSkeleton class="h-14 rounded-tile" />
      <UiSkeleton class="aspect-square rounded-card" />
      <UiSkeleton class="h-40 rounded-card" />
    </template>

    <template v-else-if="ticket">
      <header>
        <p v-if="ticket.productName !== ticket.title" class="text-meta text-muted">{{ ticket.productName }}</p>
        <h1 class="mt-0.5 font-display text-h1 leading-tight font-semibold">{{ ticket.title }}</h1>
        <p v-if="ticket.subtitle" class="mt-1.5 text-muted tabular-nums">{{ ticket.subtitle }}</p>
      </header>

      <p
        v-if="justTransferred"
        role="status"
        class="rounded-tile border border-line bg-raised px-3.5 py-2.5 text-meta"
      >
        Sent. The new ticket is with {{ ticket.transfer?.toName ?? ticket.transfer?.toEmail }}.
      </p>

      <!-- The code itself -->
      <section class="card overflow-hidden" aria-labelledby="code-title">
        <h2 id="code-title" class="sr-only">Entry code</h2>
        <div class="p-4 md:p-5">
          <TicketQrCode :value="payload" :dimmed="!admits" :label="`Entry code ${ticket.code}`" />
          <p class="mt-4 text-center font-display text-h2 font-semibold tracking-[0.12em] tabular-nums">
            <span v-for="(group, index) in codeGroups" :key="index">
              <span v-if="index" class="text-subtle">-</span>{{ group }}
            </span>
          </p>
          <p v-if="admits" class="mt-2 flex items-center justify-center gap-1.5 text-center text-meta text-muted">
            <SunIcon class="size-4" aria-hidden="true" />
            Turn your brightness up so it scans first time.
          </p>
        </div>
        <p
          class="flex items-center justify-between gap-3 border-t border-line bg-raised/40 px-4 py-3 text-meta md:px-5"
        >
          <span class="text-muted">{{ current.note }}</span>
          <UiBadge :tone="current.tone">
            <CheckIcon v-if="admits" aria-hidden="true" />
            {{ current.label }}
          </UiBadge>
        </p>
      </section>

      <!-- What it admits to -->
      <section class="card divide-y divide-line" aria-labelledby="detail-title">
        <h2 id="detail-title" class="sr-only">Ticket details</h2>
        <p class="flex items-center gap-3 px-4 py-3 md:px-5">
          <UserRoundIcon class="size-4 shrink-0 text-subtle" aria-hidden="true" />
          <span class="min-w-0 flex-1 truncate">{{ ticket.holderName }}</span>
          <span class="text-meta text-muted">Holder</span>
        </p>
        <p v-if="ticket.startsAt" class="flex items-center gap-3 px-4 py-3 md:px-5">
          <ClockIcon class="size-4 shrink-0 text-subtle" aria-hidden="true" />
          <span class="min-w-0 flex-1 tabular-nums">
            {{ formatLongDate(ticket.startsAt) }}, {{ formatTime(ticket.startsAt) }}
          </span>
          <span v-if="ticket.endsAt" class="text-meta text-muted tabular-nums">ends {{ formatTime(ticket.endsAt) }}</span>
        </p>
        <p v-if="ticket.venueName" class="flex items-center gap-3 px-4 py-3 md:px-5">
          <MapPinIcon class="size-4 shrink-0 text-subtle" aria-hidden="true" />
          <span class="min-w-0 flex-1 truncate">{{ ticket.venueName }}</span>
          <span v-if="ticket.roomName" class="text-meta text-muted">{{ ticket.roomName }}</span>
        </p>
        <NuxtLink :to="`/orders/${ticket.orderId}`" class="row-interactive flex items-center gap-3 px-4 py-3 md:px-5">
          <ReceiptTextIcon class="size-4 shrink-0 text-subtle" aria-hidden="true" />
          <span class="min-w-0 flex-1">Order and receipt</span>
          <span class="text-meta text-muted">View</span>
        </NuxtLink>
      </section>

      <p v-if="ticket.origin" class="px-1 text-meta text-muted">
        {{ ticket.origin.fromName }} passed this to you on {{ formatDay(ticket.origin.at) }}.
      </p>

      <div class="flex flex-wrap gap-2">
        <UiButton v-if="ticket.startsAt && admits" variant="secondary" @click="addToCalendar">
          <CalendarPlusIcon aria-hidden="true" />
          Add to calendar
        </UiButton>
        <UiButton v-if="admits" variant="secondary" @click="transferOpen = true">
          <SendIcon aria-hidden="true" />
          Pass it on
        </UiButton>
      </div>

      <p class="px-1 text-meta text-muted">
        This ticket works without a connection once the page has loaded, so you can open it in the queue.
      </p>

      <TicketTransferSheet v-model:open="transferOpen" :ticket="ticket" @transferred="onTransferred" />
    </template>
  </div>
</template>

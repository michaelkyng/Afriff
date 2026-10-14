<script setup lang="ts">
import { ArrowLeftIcon, BanIcon, MegaphoneIcon, MoveRightIcon } from 'lucide-vue-next'
import type { ScreeningChange, UpdateDraft } from '@afriff/api/ops'

const route = useRoute()
const id = String(route.params.id)
const ops = useOps()
const { data: programme, refresh: refreshProgramme } = useOpsProgramme()
const session = { kind: 'screening' as const, id }
const { data: tickets, refresh: refreshTickets } = useAsyncData(`ops:tickets:${id}`, () => ops.ticketsFor(session))
const { data: count } = useAsyncData(`ops:door:${id}`, () => ops.doorCount(session))
const { data: updates, refresh: refreshUpdates } = useAsyncData('ops:updates', () => ops.updates())

const screening = computed(() => programme.value?.screenings.find((item) => item.id === id))
const film = computed(() => programme.value?.films.find((item) => item.id === screening.value?.filmId))
const venue = computed(() => programme.value?.venues.find((item) => item.id === screening.value?.venueId))
const screen = computed(() => venue.value?.screens.find((item) => item.id === screening.value?.screenId))
const title = computed(() => film.value?.title ?? 'Screening')
const when = computed(() => (screening.value ? `${formatDay(screening.value.startsAt)}, ${formatTime(screening.value.startsAt)} to ${formatTime(screening.value.endsAt)}` : ''))
const ended = computed(() => Boolean(screening.value && Date.parse(screening.value.endsAt) < Date.now()))
const valid = computed(() => (tickets.value ?? []).filter((item) => item.status === 'valid' || item.status === 'used'))
const related = computed(() => (updates.value ?? []).filter((item) => item.subject?.screeningId === id))

useHead({ title: () => title.value })
watchEffect(() => {
  if (programme.value && !screening.value) showError({ statusCode: 404, statusMessage: 'That screening is not in the programme' })
})

const moving = ref(false)
const cancelling = ref(false)
const composing = ref(false)
const draft = ref<UpdateDraft | null>(null)

/** After a change: reload what it touched, then offer the announcement it calls for. */
async function changed(change: ScreeningChange) {
  await Promise.all([refreshProgramme(), refreshTickets()])
  draft.value = change.draft
  composing.value = true
}

function compose() {
  draft.value = { kind: 'schedule', severity: 'normal', title: '', body: '', subject: { screeningId: id, filmId: screening.value?.filmId } }
  composing.value = true
}
</script>

<template>
  <div v-if="screening">
    <OpsHeader :title="title">
      <template #before>
        <NuxtLink to="/programme" class="mb-2 inline-flex items-center gap-1 text-meta font-medium text-muted hover:text-ink">
          <ArrowLeftIcon class="size-3.5" aria-hidden="true" />
          Programme
        </NuxtLink>
      </template>
      <template #description>
        <span class="tabular-nums">{{ when }}</span> · {{ venue?.name }}, {{ screen?.name }}
        <UiBadge v-if="screening.cancelled" tone="danger" class="ml-1.5 align-middle">Cancelled</UiBadge>
      </template>
      <UiButton variant="secondary" :disabled="screening.cancelled || ended" @click="moving = true">
        <MoveRightIcon aria-hidden="true" />
        Move
      </UiButton>
      <UiButton variant="secondary" @click="compose">
        <MegaphoneIcon aria-hidden="true" />
        Tell attendees
      </UiButton>
      <UiButton variant="danger" :disabled="screening.cancelled || ended" @click="cancelling = true">
        <BanIcon aria-hidden="true" />
        Cancel
      </UiButton>
    </OpsHeader>

    <div class="grid grid-cols-2 gap-3 md:grid-cols-4">
      <StatTile label="Seats sold" :value="`${screening.sold} / ${screening.capacity}`" />
      <StatTile label="Single tickets" :value="valid.length" hint="Valid or used" />
      <StatTile label="Checked in" :value="count?.admitted ?? 0" :hint="count?.passAdmitted ? `${count.passAdmitted} on passes` : undefined" />
      <StatTile label="Updates about it" :value="related.length" />
    </div>

    <section class="mt-8" aria-labelledby="updates-title">
      <UiSectionHeader title="Updates about this screening" title-id="updates-title" />
      <UiCard v-if="!related.length" class="text-meta text-muted">None yet.</UiCard>
      <UiCard v-else :padded="false" class="divide-y divide-line">
        <div v-for="update in related" :key="update.id" class="px-4 py-3">
          <p class="font-semibold">{{ update.title }} <UiBadge v-if="update.severity === 'urgent'" tone="accent" class="ml-1">Urgent</UiBadge></p>
          <p class="mt-0.5 text-meta text-pretty text-muted">{{ update.body }}</p>
          <p class="mt-1 text-label text-subtle">{{ Date.parse(update.publishedAt) > Date.now() ? 'Scheduled for' : 'Published' }} {{ formatDay(update.publishedAt) }}, {{ formatTime(update.publishedAt) }}</p>
        </div>
      </UiCard>
    </section>

    <section class="mt-8" aria-labelledby="holders-title">
      <UiSectionHeader title="Ticket holders" title-id="holders-title" :meta="String(tickets?.length ?? '')" />
      <UiCard v-if="tickets && !tickets.length" class="text-meta text-muted">No single tickets sold for it. Pass holders are not listed per screening.</UiCard>
      <UiCard v-else-if="tickets" :padded="false" class="overflow-x-auto">
        <table class="ops-table">
          <thead><tr><th scope="col">Holder</th><th scope="col">Code</th><th scope="col">Order</th><th scope="col">Status</th></tr></thead>
          <tbody>
            <tr v-for="ticket in tickets" :key="ticket.id">
              <td class="font-medium">{{ ticket.holderName }}</td>
              <td class="whitespace-nowrap tabular-nums">{{ ticket.code }}</td>
              <td><NuxtLink :to="`/orders/${ticket.orderId}`" class="hover:underline">View order</NuxtLink></td>
              <td><UiBadge :tone="TICKET_STATUS[ticket.status].tone">{{ TICKET_STATUS[ticket.status].label }}</UiBadge></td>
            </tr>
          </tbody>
        </table>
      </UiCard>
    </section>

    <MoveScreeningSheet v-if="programme" v-model:open="moving" :screening="screening" :venues="programme.venues" :title="title" @moved="changed" />
    <CancelScreeningSheet v-model:open="cancelling" :screening="screening" :title="title" :tickets="(tickets ?? []).filter((item) => item.status === 'valid').length" @cancelled="changed" />
    <UpdateComposer v-model:open="composing" :draft="draft" :subject-label="`${title}, ${when}`" @published="refreshUpdates()" />
  </div>
  <UiSkeleton v-else class="h-96 rounded-card" />
</template>

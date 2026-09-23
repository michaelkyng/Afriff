<script setup lang="ts">
import {
  BellIcon,
  BellOffIcon,
  BookmarkIcon,
  CalendarDaysIcon,
  ClockAlertIcon,
  TicketCheckIcon,
  TriangleAlertIcon,
} from 'lucide-vue-next'
import { buildPlan, groupPlanByDay, planWarnings, warningsByKey } from '@afriff/api/plan'

/**
 * The attendee's own week: what they have tickets for and what they have saved,
 * in one list, with the places it cannot actually be kept called out.
 */
useHead({ title: 'My festival' })

const api = useApi()
const plan = usePlanStore()
const { isSignedIn } = useAuth()
const { data: festival } = useFestival()
const { now } = useFestivalClock(festival)
const { timeline, lookups, pending: programmePending } = useProgramme()
const {
  supported: remindersSupported,
  permission: remindersPermission,
  toggle: toggleReminder,
  schedule: scheduleReminders,
  store: reminderStore,
} = useReminders()

/** Tickets count towards the plan, so they are fetched once someone is signed in. */
const { data: tickets, refresh: refreshTickets } = useLazyAsyncData('plan:tickets', () => api.tickets.list(), {
  immediate: false,
  default: () => [],
})
watchEffect(() => {
  if (isSignedIn.value) refreshTickets()
})

const entries = computed(() => buildPlan(timeline.value, tickets.value ?? [], plan.items))
const days = computed(() => groupPlanByDay(entries.value))
const warnings = computed(() => planWarnings(entries.value))
const flagged = computed(() => warningsByKey(warnings.value))

const upcoming = computed(() => entries.value.filter((entry) => Date.parse(entry.endsAt) >= now.value.getTime()))
const ticketCount = computed(() => entries.value.filter((entry) => entry.source === 'ticket').length)

/** Saved films, resolved against the programme so the cards can be drawn. */
const watchlist = computed(() => {
  const films = lookups.value?.film
  if (!films) return []
  return plan.films.map((item) => films.get(item.refId)).filter((film) => film !== undefined)
})

const dayLabel = (date: string) => festival.value?.days.find((day) => day.date === date)?.label ?? formatDay(date)
const isToday = (date: string) => date === lagosDateKey(now.value)

// ------------------------------------------------------------------ reminders

/** Reminders only make sense for slots still on the plan. */
watchEffect(() => reminderStore.prune(new Set(entries.value.map((entry) => entry.key))))

// One timer per upcoming reminder, reset whenever the plan or the clock moves on.
onMounted(() => {
  let cancel: (() => void) | undefined
  watchEffect((onCleanup) => {
    cancel?.()
    cancel = scheduleReminders(upcoming.value)
    onCleanup(() => cancel?.())
  })
})
</script>

<template>
  <div class="space-y-6">
    <AppPageHeader
      title="My festival"
      description="What you have tickets for and what you have saved, in the order it happens."
    >
      <template #actions>
        <UiButton to="/programme" variant="secondary" size="sm">
          <CalendarDaysIcon aria-hidden="true" />
          Browse the programme
        </UiButton>
      </template>
    </AppPageHeader>

    <p v-if="!isSignedIn && plan.count" class="rounded-tile border border-line bg-raised px-3.5 py-2.5 text-meta">
      Saved on this device.
      <NuxtLink to="/signin?redirect=/my-festival" class="font-medium text-ink underline decoration-line-strong hover:decoration-current">
        Sign in
      </NuxtLink>
      to keep your plan and see your tickets here.
    </p>

    <div v-if="programmePending" class="grid gap-3 md:grid-cols-2">
      <UiSkeleton v-for="n in 3" :key="n" class="h-24 rounded-card" />
    </div>

    <UiEmptyState
      v-else-if="!entries.length && !watchlist.length"
      :icon="BookmarkIcon"
      title="Nothing saved yet"
      description="Save a film or a screening from the programme and it lands here, with clashes flagged before you buy."
    >
      <UiButton to="/programme">Browse the programme</UiButton>
      <UiButton to="/tickets" variant="secondary">See tickets</UiButton>
    </UiEmptyState>

    <template v-else>
      <!-- Where the plan does not work -->
      <section v-if="warnings.length" aria-labelledby="warnings-title" class="space-y-2">
        <UiSectionHeader
          title="Worth a look"
          title-id="warnings-title"
          :meta="`${warnings.length} ${warnings.length === 1 ? 'thing' : 'things'}`"
        />
        <ul class="space-y-2">
          <li
            v-for="(warning, index) in warnings"
            :key="index"
            class="card flex items-start gap-3 p-3.5"
            :class="warning.kind === 'clash' ? 'border-danger/35' : 'border-accent/35'"
          >
            <component
              :is="warning.kind === 'clash' ? TriangleAlertIcon : ClockAlertIcon"
              class="mt-0.5 size-4.5 shrink-0"
              :class="warning.kind === 'clash' ? 'text-danger' : 'text-accent-ink'"
              aria-hidden="true"
            />
            <div class="min-w-0">
              <p class="font-semibold">
                {{ warning.kind === 'clash' ? 'These run over each other' : `Only ${warning.gapMinutes} minutes between venues` }}
              </p>
              <p class="mt-0.5 text-meta text-muted tabular-nums">
                {{ warning.a.item.title }} ({{ formatTime(warning.a.startsAt) }} to {{ formatTime(warning.a.endsAt) }},
                {{ warning.a.item.venue.shortName }})
                and
                {{ warning.b.item.title }} ({{ formatTime(warning.b.startsAt) }}, {{ warning.b.item.venue.shortName }})
              </p>
            </div>
          </li>
        </ul>
      </section>

      <!-- The schedule -->
      <section v-if="days.length" aria-labelledby="schedule-title" class="space-y-5">
        <UiSectionHeader
          title="Your schedule"
          title-id="schedule-title"
          :meta="ticketCount ? `${ticketCount} with a ticket` : undefined"
        />

        <section v-for="day in days" :key="day.date" :aria-label="dayLabel(day.date)">
          <h3 class="mb-2 flex items-baseline gap-2 px-1 font-display text-h3 font-semibold">
            {{ dayLabel(day.date) }}
            <span v-if="isToday(day.date)" class="text-meta font-medium text-accent-ink">Today</span>
          </h3>
          <ul class="space-y-2">
            <li v-for="entry in day.entries" :key="entry.key">
              <article
                class="card flex items-center gap-3 p-3"
                :class="[
                  flagged.get(entry.key) === 'clash' && 'border-danger/30',
                  flagged.get(entry.key) === 'tight' && 'border-accent/30',
                  Date.parse(entry.endsAt) < now.getTime() && 'opacity-60',
                ]"
              >
                <div class="w-14 shrink-0 text-center tabular-nums">
                  <p class="font-semibold">{{ formatTime(entry.startsAt) }}</p>
                  <p class="text-micro text-muted">to {{ formatTime(entry.endsAt) }}</p>
                </div>

                <div class="min-w-0 flex-1">
                  <h4 class="truncate leading-snug font-semibold">
                    <NuxtLink
                      v-if="entry.item.kind === 'screening'"
                      :to="`/programme/${entry.item.film.slug}`"
                      class="hover:underline"
                    >
                      {{ entry.item.title }}
                    </NuxtLink>
                    <template v-else>{{ entry.item.title }}</template>
                  </h4>
                  <p class="truncate text-meta text-muted">{{ entry.item.venue.shortName }}, {{ entry.item.room }}</p>
                  <div class="mt-1.5 flex flex-wrap gap-1">
                    <UiBadge v-if="entry.source === 'ticket'" tone="success">
                      <TicketCheckIcon aria-hidden="true" />
                      Ticket
                    </UiBadge>
                    <UiBadge v-else>Saved</UiBadge>
                    <UiBadge v-if="flagged.get(entry.key) === 'clash'" tone="danger">Clash</UiBadge>
                    <UiBadge v-else-if="flagged.get(entry.key) === 'tight'" tone="accent">Tight</UiBadge>
                  </div>
                </div>

                <div class="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    class="pressable grid size-8 place-items-center rounded-full border transition-colors duration-160 ease-out"
                    :class="reminderStore.has(entry.key)
                      ? 'border-accent bg-accent-soft text-accent-ink'
                      : 'border-line bg-surface text-muted hover:border-line-strong hover:text-ink'"
                    :aria-pressed="reminderStore.has(entry.key)"
                    :aria-label="`${reminderStore.has(entry.key) ? 'Turn off' : 'Turn on'} the reminder for ${entry.item.title}`"
                    @click="toggleReminder(entry.key)"
                  >
                    <BellIcon v-if="reminderStore.has(entry.key)" class="size-4" />
                    <BellOffIcon v-else class="size-4" />
                  </button>
                  <PlanSaveButton
                    v-if="entry.source === 'saved'"
                    :kind="entry.kind"
                    :ref-id="entry.item.id"
                    :name="entry.item.title"
                    size="sm"
                  />
                  <UiButton
                    v-else-if="entry.ticket"
                    :to="`/tickets/${entry.ticket.id}`"
                    variant="ghost"
                    size="sm"
                  >
                    Ticket
                  </UiButton>
                </div>
              </article>
            </li>
          </ul>
        </section>

        <p class="px-1 text-meta text-muted">
          <template v-if="remindersPermission === 'denied'">
            Reminders are blocked for this site in your browser settings.
          </template>
          <template v-else-if="!remindersSupported">
            This browser cannot show reminders.
          </template>
          <template v-else>
            Reminders arrive {{ reminderStore.leadMinutes }} minutes before, on this device, while the app is open.
          </template>
        </p>
      </section>

      <!-- Watchlist -->
      <section v-if="watchlist.length" aria-labelledby="watchlist-title">
        <UiSectionHeader
          title="Watchlist"
          title-id="watchlist-title"
          :meta="`${watchlist.length} ${watchlist.length === 1 ? 'film' : 'films'}`"
        />
        <ul class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <li v-for="film in watchlist" :key="film.id" class="relative">
            <FilmCard :film="film" :section="lookups?.section.get(film.sectionId)" />
            <PlanSaveButton
              class="absolute top-2 right-2 z-[4]"
              kind="film"
              :ref-id="film.id"
              :name="film.title"
              size="sm"
            />
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>

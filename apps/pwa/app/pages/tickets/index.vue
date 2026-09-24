<script setup lang="ts">
import {
  RefreshCwIcon,
  ShoppingBagIcon,
  TicketCheckIcon,
  TicketIcon,
  TriangleAlertIcon,
  UserRoundIcon,
} from 'lucide-vue-next'
import { ticketState } from '@afriff/api/tickets'
import type { TicketProduct } from '@afriff/api'
import type { EventItem, ScreeningItem } from '@afriff/api/programme'

/**
 * Two jobs, two tabs: what is on sale, and what this attendee already owns.
 * The tab lives in the URL (`?view=mine`), so both are linkable.
 */
useHead({ title: 'Tickets' })

const route = useRoute()
const router = useRouter()
const cart = useCartStore()
const { isSignedIn } = useAuth()
const { data: festival } = useFestival()
const { data: products, pending, error, refresh } = useCatalog()
const { timeline } = useProgramme()
const { now } = useFestivalClock(festival)

type View = 'buy' | 'mine'
const view = computed<View>({
  get: () => (route.query.view === 'mine' ? 'mine' : 'buy'),
  set: (value) => {
    router.replace({ query: { ...route.query, view: value === 'mine' ? 'mine' : undefined } })
  },
})
const viewOptions = [
  { value: 'buy' as const, label: 'Buy', icon: TicketIcon },
  { value: 'mine' as const, label: 'My tickets', icon: TicketCheckIcon },
]

// ------------------------------------------------------------------ buy

/** Only what is still to come can be bought. */
const screenings = computed(() =>
  timeline.value.filter((item): item is ScreeningItem => item.kind === 'screening' && !hasEnded(item, now.value)),
)
const events = computed(() =>
  timeline.value.filter((item): item is EventItem => item.kind === 'event' && !hasEnded(item, now.value)),
)

const chosen = ref<TicketProduct | null>(null)
const sheetOpen = ref(false)
const preselectedScreening = ref<string | undefined>()
const added = ref(false)

function choose(product: TicketProduct, screeningId?: string) {
  chosen.value = product
  preselectedScreening.value = screeningId
  sheetOpen.value = true
}

function onAdded() {
  added.value = true
  setTimeout(() => (added.value = false), 4000)
}

const inCart = (productId: string) =>
  cart.lines.filter((line) => line.productId === productId).reduce((sum, line) => sum + line.quantity, 0)

/** Arriving from a film page: /tickets?screening=scr_x opens the single-screening sheet. */
const deepLinkDone = ref(false)
watchEffect(() => {
  const screeningId = route.query.screening
  if (deepLinkDone.value || typeof screeningId !== 'string' || !products.value || !screenings.value.length) return
  const product = products.value.find((item) => item.validity.type === 'screening')
  if (!product) return
  deepLinkDone.value = true
  choose(product, screeningId)
})

// ------------------------------------------------------------------ mine

const {
  tickets: myTickets,
  error: ticketsError,
  loading: ticketsLoading,
  refresh: refreshTickets,
  ensure: ensureTickets,
} = useMyTickets()

// Only fetched once the tab is opened by someone signed in.
watchEffect(() => {
  if (view.value === 'mine') ensureTickets()
})

/**
 * What still admits someone comes first: undated passes, then what is coming up.
 * Anything spent — used, expired, passed on — drops to the bottom.
 */
const groups = computed(() => {
  const all = myTickets.value ?? []
  const live = all.filter((ticket) => ticketState(ticket, now.value) === 'valid')
  return {
    passes: live.filter((ticket) => !ticket.startsAt),
    upcoming: live.filter((ticket) => ticket.startsAt),
    past: all.filter((ticket) => ticketState(ticket, now.value) !== 'valid'),
  }
})
</script>

<template>
  <div class="space-y-6">
    <AppPageHeader
      title="Tickets"
      :description="view === 'buy'
        ? 'Festival and day passes, single screenings, masterclasses and the two gala nights.'
        : 'Everything you have bought, ready for the door.'"
    >
      <template #actions>
        <UiSegmented v-model="view" :options="viewOptions" label="Tickets view" />
        <UiButton v-if="!cart.isEmpty" to="/cart" variant="secondary" size="sm">
          <ShoppingBagIcon aria-hidden="true" />
          Cart
          <span class="grid size-5 place-items-center rounded-full bg-accent text-micro font-semibold text-on-accent tabular-nums">
            {{ cart.count }}
          </span>
        </UiButton>
      </template>
    </AppPageHeader>

    <!-- ================================================= Buy -->
    <template v-if="view === 'buy'">
      <p v-if="added" role="status" class="rounded-tile border border-line bg-raised px-3.5 py-2.5 text-meta">
        Added to your cart.
        <NuxtLink to="/cart" class="font-medium text-ink underline decoration-line-strong hover:decoration-current">
          Go to cart
        </NuxtLink>
      </p>

      <UiEmptyState
        v-if="error && !products"
        :icon="TriangleAlertIcon"
        title="We couldn’t load the tickets"
        description="Check your connection and try again."
      >
        <UiButton variant="secondary" @click="refresh()">
          <RefreshCwIcon aria-hidden="true" />
          Try again
        </UiButton>
      </UiEmptyState>

      <ul v-else class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <template v-if="pending">
          <li v-for="n in 6" :key="n"><UiSkeleton class="h-72 rounded-card" /></li>
        </template>
        <template v-else>
          <li v-for="product in products" :key="product.id">
            <PassProductCard :product="product" :in-cart="inCart(product.id)" @choose="choose(product)" />
          </li>
        </template>
      </ul>

      <p class="text-meta text-muted">
        Prices include VAT. Tickets are held for you as soon as a payment goes through, and they appear under
        My tickets.
      </p>
    </template>

    <!-- ================================================= My tickets -->
    <template v-else>
      <UiEmptyState
        v-if="!isSignedIn"
        :icon="UserRoundIcon"
        title="Sign in to see your tickets"
        description="Your tickets are tied to your account, so they follow you to any device."
      >
        <UiButton to="/signin?redirect=/tickets%3Fview%3Dmine">Sign in</UiButton>
        <UiButton to="/signup?redirect=/tickets%3Fview%3Dmine" variant="secondary">Create an account</UiButton>
      </UiEmptyState>

      <div v-else-if="ticketsLoading" class="grid gap-3 md:grid-cols-2">
        <UiSkeleton v-for="n in 2" :key="n" class="h-40 rounded-card" />
      </div>

      <UiEmptyState
        v-else-if="ticketsError"
        :icon="RefreshCwIcon"
        title="We couldn’t load your tickets"
        description="Check your connection and try again."
      >
        <UiButton variant="secondary" @click="refreshTickets()">Try again</UiButton>
      </UiEmptyState>

      <UiEmptyState
        v-else-if="!myTickets?.length"
        :icon="TicketCheckIcon"
        title="No tickets yet"
        description="Whatever you buy shows up here with its entry code."
      >
        <UiButton @click="view = 'buy'">Browse tickets</UiButton>
      </UiEmptyState>

      <div v-else class="space-y-7">
        <section v-if="groups.passes.length" aria-labelledby="passes-title">
          <UiSectionHeader title="Passes" title-id="passes-title" />
          <ul class="grid gap-3 md:grid-cols-2">
            <li v-for="ticket in groups.passes" :key="ticket.id"><TicketCard :ticket="ticket" :now="now" /></li>
          </ul>
        </section>

        <section v-if="groups.upcoming.length" aria-labelledby="upcoming-title">
          <UiSectionHeader title="Coming up" title-id="upcoming-title" :meta="`${groups.upcoming.length}`" />
          <ul class="grid gap-3 md:grid-cols-2">
            <li v-for="ticket in groups.upcoming" :key="ticket.id"><TicketCard :ticket="ticket" :now="now" /></li>
          </ul>
        </section>

        <section v-if="groups.past.length" aria-labelledby="past-title">
          <UiSectionHeader title="Past" title-id="past-title" />
          <ul class="grid gap-3 md:grid-cols-2">
            <li v-for="ticket in groups.past" :key="ticket.id"><TicketCard :ticket="ticket" :now="now" /></li>
          </ul>
        </section>
      </div>
    </template>

    <PassOptionSheet
      v-if="chosen && festival"
      v-model:open="sheetOpen"
      :product="chosen"
      :days="festival.days"
      :screenings="screenings"
      :events="events"
      :screening-id="preselectedScreening"
      @added="onAdded"
    />
  </div>
</template>

<script setup lang="ts">
import type { FestivalDay, TicketProduct, TicketSelection } from '@afriff/api'
import type { EventItem, ScreeningItem } from '@afriff/api/programme'

/**
 * Picks what a product applies to (a day, a screening, a session) and how many,
 * then puts it in the cart. Products with nothing to choose only show quantity.
 */
const props = defineProps<{
  product: TicketProduct
  days: FestivalDay[]
  screenings: ScreeningItem[]
  events: EventItem[]
  /** Preselected screening, when arriving from a film page. */
  screeningId?: string
}>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ added: [] }>()

const cart = useCartStore()

const quantity = ref(1)
const selectedDay = ref<string | null>(null)
const selectedScreening = ref<string | null>(null)
const selectedEvent = ref<string | null>(null)
const search = ref('')
const error = ref('')

const validity = computed(() => props.product.validity)

/** Screenings that are still to come and have seats, newest choice first. */
const screeningOptions = computed(() => {
  const term = search.value.trim().toLowerCase()
  return props.screenings
    .filter((item) => item.availability.status !== 'sold_out')
    .filter((item) => !term || `${item.title} ${item.venue.shortName}`.toLowerCase().includes(term))
    .slice(0, 40)
})

const eventOptions = computed(() => {
  if (validity.value.type !== 'event') return []
  const { eventKind, eventId } = validity.value
  return props.events.filter((item) => (eventId ? item.event.id === eventId : item.event.kind === eventKind))
})

const selection = computed<TicketSelection | undefined>(() => {
  switch (validity.value.type) {
    case 'day': return selectedDay.value ? { day: selectedDay.value } : undefined
    case 'screening': return selectedScreening.value ? { screeningId: selectedScreening.value } : undefined
    case 'event': return selectedEvent.value ? { eventId: selectedEvent.value } : undefined
    default: return undefined
  }
})

/** What the attendee is buying, in words, for the cart and the button. */
const chosen = computed(() => {
  switch (validity.value.type) {
    case 'day': {
      const day = props.days.find((item) => item.date === selectedDay.value)
      return day ? { title: props.product.name, detail: day.label } : null
    }
    case 'screening': {
      const item = props.screenings.find((screening) => screening.screening.id === selectedScreening.value)
      return item
        ? { title: item.title, detail: `${formatDay(item.startsAt)}, ${formatTime(item.startsAt)} · ${item.venue.shortName}` }
        : null
    }
    case 'event': {
      const item = eventOptions.value.find((option) => option.event.id === selectedEvent.value)
      return item
        ? { title: item.title, detail: `${formatDay(item.startsAt)}, ${formatTime(item.startsAt)} · ${item.venue.name}` }
        : null
    }
    default:
      return { title: props.product.name, detail: undefined }
  }
})

/** Seats left where the choice has its own limit, so the stepper cannot overshoot. */
const maxQuantity = computed(() => {
  const limits = [props.product.maxPerOrder]
  if (props.product.remaining !== null) limits.push(props.product.remaining)
  const screening = props.screenings.find((item) => item.screening.id === selectedScreening.value)
  if (screening) limits.push(screening.availability.seatsLeft)
  return Math.max(1, Math.min(...limits))
})

function reset() {
  quantity.value = 1
  error.value = ''
  search.value = ''
  selectedDay.value = null
  selectedEvent.value = eventOptions.value.length === 1 ? (eventOptions.value[0]?.event.id ?? null) : null
  selectedScreening.value = props.screeningId ?? null
}

/**
 * Immediate, because a deep link (`/tickets?screening=…`) mounts this sheet with
 * `open` already true: without it the preselected screening would never be picked up.
 */
watch(
  open,
  (isOpen) => {
    if (isOpen) reset()
  },
  { immediate: true },
)

watch(maxQuantity, (max) => {
  if (quantity.value > max) quantity.value = max
})

function addToCart() {
  const picked = chosen.value
  if (!picked) {
    error.value = 'Pick one to carry on.'
    return
  }
  cart.add(
    {
      productId: props.product.id,
      productName: props.product.name,
      quantity: quantity.value,
      selection: selection.value,
      title: picked.title,
      detail: picked.detail,
      unitPrice: props.product.price,
    },
    maxQuantity.value,
  )
  open.value = false
  emit('added')
}
</script>

<template>
  <UiSheet v-model:open="open" :title="product.name">
    <div class="space-y-5">
      <p class="text-meta text-muted">{{ product.summary }}</p>

      <!-- Which day -->
      <fieldset v-if="validity.type === 'day'">
        <legend class="mb-2.5 text-meta font-semibold text-muted">Which day</legend>
        <div class="flex flex-wrap gap-1.5">
          <UiChip
            v-for="day in days"
            :key="day.date"
            :model-value="selectedDay === day.date"
            @update:model-value="selectedDay = day.date"
          >
            {{ day.label }}
          </UiChip>
        </div>
      </fieldset>

      <!-- Which screening -->
      <fieldset v-else-if="validity.type === 'screening'">
        <legend class="mb-2.5 text-meta font-semibold text-muted">Which screening</legend>
        <UiSearchInput v-model="search" placeholder="Search films or venues" label="Search screenings" />
        <ul class="mt-3 max-h-80 space-y-1.5 overflow-y-auto overscroll-contain">
          <li v-for="item in screeningOptions" :key="item.screening.id">
            <button
              type="button"
              class="card card-interactive flex w-full items-center gap-3 p-3 text-left"
              :class="selectedScreening === item.screening.id && 'border-accent! bg-accent-soft'"
              :aria-pressed="selectedScreening === item.screening.id"
              @click="selectedScreening = item.screening.id"
            >
              <span class="min-w-0 flex-1">
                <span class="block truncate font-semibold">{{ item.title }}</span>
                <span class="block truncate text-meta text-muted tabular-nums">
                  {{ formatDay(item.startsAt) }}, {{ formatTime(item.startsAt) }} · {{ item.venue.shortName }}
                </span>
              </span>
              <span
                v-if="item.availability.status === 'selling_fast'"
                class="shrink-0 text-label font-medium text-accent-ink tabular-nums"
              >
                {{ item.availability.seatsLeft }} left
              </span>
            </button>
          </li>
          <li v-if="!screeningOptions.length" class="py-6 text-center text-meta text-muted">
            No screenings match that search.
          </li>
        </ul>
      </fieldset>

      <!-- Which session -->
      <fieldset v-else-if="validity.type === 'event' && eventOptions.length > 1">
        <legend class="mb-2.5 text-meta font-semibold text-muted">Which session</legend>
        <ul class="space-y-1.5">
          <li v-for="item in eventOptions" :key="item.event.id">
            <button
              type="button"
              class="card card-interactive flex w-full items-center gap-3 p-3 text-left"
              :class="selectedEvent === item.event.id && 'border-accent! bg-accent-soft'"
              :aria-pressed="selectedEvent === item.event.id"
              @click="selectedEvent = item.event.id"
            >
              <span class="min-w-0 flex-1">
                <span class="block truncate font-semibold">{{ item.title }}</span>
                <span class="block truncate text-meta text-muted tabular-nums">
                  {{ formatDay(item.startsAt) }}, {{ formatTime(item.startsAt) }} · {{ item.venue.name }}
                </span>
              </span>
            </button>
          </li>
        </ul>
      </fieldset>

      <div v-else-if="chosen?.detail" class="rounded-tile border border-line bg-raised px-3.5 py-3 text-meta">
        <p class="font-medium">{{ chosen.title }}</p>
        <p class="mt-0.5 text-muted tabular-nums">{{ chosen.detail }}</p>
      </div>

      <div class="flex items-center justify-between gap-4">
        <div>
          <p class="font-medium">How many</p>
          <p class="text-meta text-muted">Up to {{ maxQuantity }} per order.</p>
        </div>
        <UiStepper v-model="quantity" label="ticket" :max="maxQuantity" />
      </div>

      <p v-if="error" role="alert" class="text-meta text-danger">{{ error }}</p>
    </div>

    <template #footer>
      <div class="flex items-center justify-between gap-3">
        <p class="text-meta text-muted">
          <span class="font-semibold text-ink tabular-nums">
            {{ formatMoney({ amount: product.price.amount * quantity, currency: 'NGN' }) }}
          </span>
          <template v-if="quantity > 1"> for {{ quantity }}</template>
        </p>
        <UiButton :disabled="!chosen" @click="addToCart">Add to cart</UiButton>
      </div>
    </template>
  </UiSheet>
</template>

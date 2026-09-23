<script setup lang="ts">
import { CheckIcon, ClockIcon, TicketCheckIcon, TriangleAlertIcon } from 'lucide-vue-next'
import { isApiError } from '@afriff/api'
import type { OrderStatus } from '@afriff/api'
import type { PaymentDraft } from '~/components/pass/PaymentFields.vue'

definePageMeta({ middleware: 'auth' })

const route = useRoute()
const api = useApi()
const { user } = useAuth()
const { refresh: refreshCatalog } = useCatalog()
const id = String(route.params.id)

const { data: order, status, error: loadError, refresh } = useLazyAsyncData(`order:${id}`, () => api.orders.get(id))
/** `status` rather than `pending`: a lazy fetch is idle, not pending, on the first render. */
const loading = computed(() => status.value !== 'success' && status.value !== 'error')

useHead({ title: () => (order.value ? `Order ${order.value.reference}` : 'Order') })
usePageCrumb(() => (order.value ? `Order ${order.value.reference}` : undefined))

watchEffect(() => {
  if (loadError.value) showError({ statusCode: 404, statusMessage: 'Order not found' })
})

const tone: Record<OrderStatus, { icon: typeof CheckIcon; title: string; className: string }> = {
  paid: { icon: CheckIcon, title: 'Paid', className: 'text-success bg-success-soft' },
  pending: { icon: ClockIcon, title: 'Waiting for payment', className: 'text-accent-ink bg-accent-soft' },
  failed: { icon: TriangleAlertIcon, title: 'Payment failed', className: 'text-danger bg-danger-soft' },
}

const headline = computed(() => {
  const current = order.value
  if (!current) return ''
  if (current.status === 'paid') return 'Your tickets are ready'
  if (current.status === 'failed') return current.payment.failureReason ?? 'That payment did not go through.'
  return current.payment.method === 'transfer'
    ? 'Send the transfer to finish your order'
    : 'Your bank is still confirming this payment'
})

const retrying = ref(false)
const working = ref(false)
const message = ref('')
const payment = reactive<PaymentDraft>({ method: 'card', cardName: '', cardNumber: '', expiry: '', cvv: '' })
watchEffect(() => {
  payment.cardName ||= user.value?.name ?? ''
})

async function run(action: () => Promise<unknown>) {
  working.value = true
  message.value = ''
  try {
    await action()
    await refresh()
    refreshCatalog()
    retrying.value = false
  }
  catch (error) {
    message.value = isApiError(error) ? error.message : 'That did not work. Try again.'
  }
  finally {
    working.value = false
  }
}

const retry = () =>
  run(() =>
    api.orders.pay(
      id,
      payment.method === 'card'
        ? { method: 'card', cardName: payment.cardName, cardNumber: payment.cardNumber, expiry: payment.expiry, cvv: payment.cvv }
        : { method: 'transfer' },
    ),
  )

const confirmTransfer = () => run(() => api.orders.confirmTransfer(id))
</script>

<template>
  <div class="mx-auto max-w-3xl space-y-6">
    <AppBackLink fallback="/tickets?view=mine" label="Tickets" class="md:hidden" />

    <div v-if="loading || !order" class="space-y-4" aria-busy="true">
      <UiSkeleton class="h-10 w-2/3" />
      <UiSkeleton class="h-32 w-full rounded-card" />
    </div>

    <template v-else>
      <header>
        <p class="flex items-center gap-2">
          <span class="grid size-8 place-items-center rounded-full" :class="tone[order.status].className" aria-hidden="true">
            <component :is="tone[order.status].icon" class="size-4.5" />
          </span>
          <span class="text-meta font-medium">{{ tone[order.status].title }}</span>
          <span class="text-meta text-muted tabular-nums">· {{ order.reference }}</span>
        </p>
        <h1 class="mt-3 font-display text-h1 font-semibold">{{ headline }}</h1>
        <p class="mt-1.5 text-muted">
          Placed {{ formatDay(order.placedAt) }} at {{ formatTime(order.placedAt) }}.
          <template v-if="order.status === 'paid'">
            {{ order.ticketIds.length }} {{ order.ticketIds.length === 1 ? 'ticket is' : 'tickets are' }} under My tickets.
          </template>
        </p>
      </header>

      <!-- What happens next -->
      <UiCard v-if="order.status === 'pending' && order.payment.method === 'transfer'" class="space-y-3">
        <h2 class="font-semibold">Transfer details</h2>
        <dl class="grid gap-2 text-meta sm:grid-cols-2">
          <div><dt class="text-muted">Bank</dt><dd class="font-medium">Demo Bank Nigeria</dd></div>
          <div><dt class="text-muted">Account name</dt><dd class="font-medium">AFRIFF Tickets Ltd</dd></div>
          <div><dt class="text-muted">Account number</dt><dd class="font-medium tabular-nums">0123456789</dd></div>
          <div>
            <dt class="text-muted">Reference</dt>
            <dd class="font-semibold tabular-nums">{{ order.payment.reference }}</dd>
          </div>
        </dl>
        <p class="text-meta text-muted">
          Quote the reference so we can match your transfer. In this demo build you can confirm it yourself.
        </p>
        <UiButton :loading="working" @click="confirmTransfer">I have sent the transfer</UiButton>
      </UiCard>

      <UiCard v-else-if="order.status !== 'paid'" class="space-y-3">
        <h2 class="font-semibold">{{ order.status === 'failed' ? 'Try another card' : 'Pay by card instead' }}</h2>
        <p v-if="!retrying" class="text-meta text-muted">
          Your tickets are held until this is settled.
        </p>
        <PaymentFields v-if="retrying" v-model="payment" :disabled="working" />
        <div class="flex flex-wrap gap-2">
          <UiButton v-if="!retrying" @click="retrying = true">Try again</UiButton>
          <template v-else>
            <UiButton :loading="working" @click="retry">Pay {{ formatMoney(order.total) }}</UiButton>
            <UiButton variant="ghost" :disabled="working" @click="retrying = false">Cancel</UiButton>
          </template>
        </div>
      </UiCard>

      <p v-if="message" role="alert" class="text-meta text-danger">{{ message }}</p>

      <OrderSummary :lines="order.lines" :total="order.total" title="Order" />

      <UiCard :padded="false">
        <dl class="divide-y divide-line text-meta">
          <div class="flex justify-between gap-4 px-4 py-3 md:px-5">
            <dt class="text-muted">Tickets for</dt>
            <dd class="text-right">{{ order.contact.name }}<br>{{ order.contact.email }}</dd>
          </div>
          <div class="flex justify-between gap-4 px-4 py-3 md:px-5">
            <dt class="text-muted">Payment</dt>
            <dd class="text-right tabular-nums">
              <template v-if="order.payment.method === 'card'">
                Card ending {{ order.payment.last4 }}
              </template>
              <template v-else>Bank transfer</template>
            </dd>
          </div>
        </dl>
      </UiCard>

      <div class="flex flex-wrap gap-2">
        <UiButton v-if="order.status === 'paid'" to="/tickets?view=mine">
          <TicketCheckIcon aria-hidden="true" />
          See your tickets
        </UiButton>
        <UiButton to="/programme" variant="secondary">Back to the programme</UiButton>
      </div>
    </template>
  </div>
</template>

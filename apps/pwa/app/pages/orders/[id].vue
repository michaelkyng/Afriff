<script setup lang="ts">
import { CheckIcon, ClockIcon, RefreshCwIcon, TicketCheckIcon, TriangleAlertIcon } from 'lucide-vue-next'
import { isApiError } from '@afriff/api'
import type { OrderStatus } from '@afriff/api'

const route = useRoute()
const router = useRouter()
const api = useApi()
const payment = usePayment()
const refreshAccount = useAccountRefresh()
const demo = useRuntimeConfig().public.apiMode === 'mock'
const id = String(route.params.id)

const { data: order, status, error: loadError } = useLazyAsyncData(`order:${id}`, () => api.orders.get(id))
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
  failed: { icon: TriangleAlertIcon, title: 'Not paid', className: 'text-danger bg-danger-soft' },
}

const headline = computed(() => {
  const current = order.value
  if (!current) return ''
  if (current.status === 'paid') return 'Your tickets are ready'
  if (current.status === 'failed') return 'That payment did not go through'
  return 'Finish paying to get your tickets'
})

/** What is happening right now: paying in the provider's checkout, or asking how a payment went. */
const working = ref<'paying' | 'checking' | null>(null)
const message = ref('')

async function run(kind: 'paying' | 'checking', action: () => Promise<void>) {
  working.value = kind
  message.value = ''
  try {
    await action()
  }
  catch (error) {
    message.value = isApiError(error) ? error.message : 'That did not work. Try again.'
    // An order paid since the page loaded says so as a conflict; show where it stands.
    if (isApiError(error) && error.code === 'conflict') order.value = await api.orders.get(id).catch(() => order.value)
  }
  finally {
    working.value = null
    // A payment that lands issues tickets; one that fails gives the stock back.
    refreshAccount()
  }
}

/** Pays, or carries on paying: the same attempt while it is open, a fresh one after a failure. */
const payNow = () => run('paying', async () => {
  order.value = await payment.pay(await api.orders.pay(id))
})

/** For a payment made but not yet seen: a bank transfer still clearing, or a closed tab. */
const checkAgain = () => run('checking', async () => {
  order.value = await api.orders.verify(id)
})

// Back from Paystack's own checkout page, which adds `?reference=` on the way.
onMounted(() => {
  if (!route.query.reference && !route.query.trxref) return
  router.replace({ query: {} })
  checkAgain()
})
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
          <UiCopyButton :value="order.reference" label="order reference" class="-ml-1.5" />
        </p>
        <h1 class="mt-3 font-display text-h1 font-semibold text-balance">{{ headline }}</h1>
        <p v-if="order.status === 'failed' && order.payment.failureReason" class="mt-1.5 text-pretty text-ink">
          {{ order.payment.failureReason }}
        </p>
        <p class="mt-1.5 text-muted">
          Placed {{ formatDay(order.placedAt) }} at {{ formatTime(order.placedAt) }}.
          <template v-if="order.status === 'paid'">
            {{ order.ticketIds.length }} {{ order.ticketIds.length === 1 ? 'ticket is' : 'tickets are' }} under My tickets<template v-if="demo">.</template>
            <template v-else>, and a confirmation is on its way to {{ order.contact.email }}.</template>
          </template>
        </p>
      </header>

      <!-- What happens next -->
      <UiCard v-if="order.status === 'pending'" class="space-y-3">
        <h2 class="font-semibold">
          {{ order.holdExpiresAt ? `Your tickets are held until ${formatTime(order.holdExpiresAt)}` : 'Your tickets are held' }}
        </h2>
        <p class="text-meta text-pretty text-muted">After that they go back on sale, and nothing is charged.</p>
        <div class="flex flex-wrap gap-2">
          <UiButton :loading="working === 'paying'" :disabled="working === 'checking'" @click="payNow">
            Pay {{ formatMoney(order.total) }}
          </UiButton>
          <UiButton variant="secondary" :loading="working === 'checking'" :disabled="working === 'paying'" @click="checkAgain">
            <RefreshCwIcon aria-hidden="true" />
            I have paid, check again
          </UiButton>
        </div>
        <p class="text-label text-pretty text-muted">A bank transfer or USSD payment can take a few minutes to clear.</p>
      </UiCard>

      <UiCard v-else-if="order.status === 'failed'" class="space-y-3">
        <h2 class="font-semibold">Try again</h2>
        <p class="text-meta text-pretty text-muted">
          Paying again holds the tickets for you once more, if they are still available. Nothing was taken for the
          attempt that failed.
        </p>
        <div>
          <UiButton :loading="working === 'paying'" @click="payNow">Pay {{ formatMoney(order.total) }}</UiButton>
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
            <dt class="text-muted">{{ order.status === 'paid' ? 'Paid with' : 'Payment' }}</dt>
            <dd class="text-right tabular-nums">{{ formatPaymentMethod(order.payment) }}</dd>
          </div>
          <div v-if="order.payment.reference" class="flex justify-between gap-4 px-4 py-3 md:px-5">
            <dt class="text-muted">Payment reference</dt>
            <dd class="text-right tabular-nums">{{ order.payment.reference }}</dd>
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

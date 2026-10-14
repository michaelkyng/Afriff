<script setup lang="ts">
import { LockIcon } from 'lucide-vue-next'

useHead({ title: 'Checkout' })
usePageCrumb('Checkout')

const api = useApi()
const cart = useCartStore()
const { user } = useAuth()
const payment = usePayment()
const refreshAccount = useAccountRefresh()
const demo = useRuntimeConfig().public.apiMode === 'mock'

const contact = reactive({ name: '', email: '', phone: '' })
const { errors, clear, show } = useFieldErrors(['name', 'email', 'phone', 'form'])

/**
 * Where the payment has got to, for the button: placing the order (which holds
 * the tickets), waiting on the attendee in the provider's checkout, then asking
 * the server how it went.
 */
type Stage = 'idle' | 'placing' | 'paying' | 'confirming'
const stage = ref<Stage>('idle')
const busy = computed(() => stage.value !== 'idle')
/** Set once an order exists, so emptying the cart does not bounce us off the page. */
const placed = ref(false)

watchEffect(() => {
  contact.name ||= user.value?.name ?? ''
  contact.email ||= user.value?.email ?? ''
  contact.phone ||= user.value?.phone ?? ''
})

// Nothing to pay for: back to the catalogue.
watchEffect(() => {
  if (cart.isEmpty && !placed.value) navigateTo('/tickets', { replace: true })
})

const label = computed(() => ({
  idle: `Pay ${formatMoney(cart.subtotal)}`,
  placing: 'Holding your tickets',
  paying: 'Waiting for payment',
  confirming: 'Confirming payment',
}[stage.value]))

async function pay() {
  clear()
  stage.value = 'placing'
  let orderId: string
  try {
    const intent = await api.orders.checkout({
      items: cart.toCheckoutItems(),
      contact: { name: contact.name, email: contact.email, phone: contact.phone },
    })
    orderId = intent.orderId
    // The order holds the tickets now; the cart has done its job.
    placed.value = true
    cart.clear()
    refreshAccount()
    stage.value = 'paying'
    await payment.pay(intent)
  }
  catch (error) {
    if (!placed.value) {
      show(error, 'form', 'We could not place that order. Try again.')
      stage.value = 'idle'
      return
    }
  }
  // Paid, still open or failed, the order page says which and what to do next.
  stage.value = 'confirming'
  refreshAccount()
  await navigateTo(`/orders/${orderId!}`)
}
</script>

<template>
  <div class="space-y-6">
    <AppPageHeader title="Checkout" />

    <form class="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start" novalidate @submit.prevent="pay">
      <div class="space-y-8">
        <section aria-labelledby="contact-title">
          <UiSectionHeader title="Who the tickets are for" title-id="contact-title" />
          <UiCard class="space-y-4">
            <UiInput v-model="contact.name" label="Full name" autocomplete="name" :error="errors.name" :disabled="busy" />
            <UiInput
              v-model="contact.email"
              label="Email"
              type="email"
              inputmode="email"
              autocomplete="email"
              hint="Your receipt and confirmation go here."
              :error="errors.email"
              :disabled="busy"
            />
            <UiInput
              v-model="contact.phone"
              label="Phone"
              type="tel"
              inputmode="tel"
              autocomplete="tel"
              placeholder="0803 123 4567"
              hint="Optional. Used if we need to reach you about a screening."
              :error="errors.phone"
              :disabled="busy"
            />
          </UiCard>
        </section>

        <section aria-labelledby="payment-title">
          <UiSectionHeader title="Payment" title-id="payment-title" />
          <UiCard>
            <PaymentMethodsNote :demo="demo" />
          </UiCard>
        </section>
      </div>

      <div class="space-y-4 lg:sticky lg:top-24">
        <OrderSummary :lines="cart.lines" :total="cart.subtotal" title="Your order" />
        <p v-if="errors.form" role="alert" class="text-meta text-danger">{{ errors.form }}</p>
        <UiButton type="submit" block size="lg" :loading="busy">
          <LockIcon v-if="!busy" aria-hidden="true" />
          {{ label }}
        </UiButton>
        <p class="text-center text-label text-pretty text-muted">
          {{ demo ? 'Demo build: no card is charged and no money moves.' : 'You pay in Paystack’s secure checkout, then come straight back here.' }}
        </p>
      </div>
    </form>
  </div>
</template>

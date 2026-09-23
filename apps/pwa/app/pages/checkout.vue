<script setup lang="ts">
import { LockIcon } from 'lucide-vue-next'
import { isApiError } from '@afriff/api'
import type { PaymentDraft } from '~/components/pass/PaymentFields.vue'

definePageMeta({ middleware: 'auth' })
useHead({ title: 'Checkout' })
usePageCrumb('Checkout')

const api = useApi()
const cart = useCartStore()
const { user } = useAuth()
const { refresh: refreshCatalog } = useCatalog()

const contact = reactive({ name: '', email: '', phone: '' })
const payment = reactive<PaymentDraft>({ method: 'card', cardName: '', cardNumber: '', expiry: '', cvv: '' })
const errors = reactive<Record<string, string>>({})
/** Set once an order exists, so emptying the cart does not bounce us off the page. */
const placed = ref(false)
const message = ref('')
const paying = ref(false)

watchEffect(() => {
  contact.name ||= user.value?.name ?? ''
  contact.email ||= user.value?.email ?? ''
  contact.phone ||= user.value?.phone ?? ''
  payment.cardName ||= user.value?.name ?? ''
})

// Nothing to pay for: back to the catalogue.
watchEffect(() => {
  if (cart.isEmpty && !placed.value) navigateTo('/tickets', { replace: true })
})

/** Maps a field path from the API ("contact.email", "payment.cvv") onto our inputs. */
function showError(error: unknown) {
  const field = isApiError(error) ? String(error.details?.field ?? '') : ''
  const key = field.split('.').at(-1) ?? ''
  const text = isApiError(error) ? error.message : 'We could not take that payment. Try again.'
  if (key && key in contact) errors[key] = text
  else if (key && key in payment) errors[key] = text
  else message.value = text
}

async function pay() {
  Object.keys(errors).forEach((key) => delete errors[key])
  message.value = ''
  paying.value = true
  try {
    const order = await api.orders.checkout({
      items: cart.toCheckoutItems(),
      contact: { name: contact.name, email: contact.email, phone: contact.phone },
      payment: payment.method === 'card'
        ? {
            method: 'card',
            cardName: payment.cardName,
            cardNumber: payment.cardNumber,
            expiry: payment.expiry,
            cvv: payment.cvv,
          }
        : { method: 'transfer' },
    })
    placed.value = true
    cart.clear()
    refreshCatalog()
    await navigateTo(`/orders/${order.id}`)
  }
  catch (error) {
    showError(error)
  }
  finally {
    paying.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <AppPageHeader title="Checkout" />

    <form class="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start" novalidate @submit.prevent="pay">
      <div class="space-y-5">
        <section aria-labelledby="contact-title" class="space-y-2">
          <h2 id="contact-title" class="px-1 text-meta font-semibold text-muted">Who the tickets are for</h2>
          <UiCard class="space-y-4">
            <UiInput v-model="contact.name" label="Full name" autocomplete="name" :error="errors.name" :disabled="paying" />
            <UiInput
              v-model="contact.email"
              label="Email"
              type="email"
              inputmode="email"
              autocomplete="email"
              hint="Your confirmation goes here."
              :error="errors.email"
              :disabled="paying"
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
              :disabled="paying"
            />
          </UiCard>
        </section>

        <section aria-labelledby="payment-title" class="space-y-2">
          <h2 id="payment-title" class="px-1 text-meta font-semibold text-muted">Payment</h2>
          <UiCard>
            <PaymentFields v-model="payment" :errors="errors" :disabled="paying" />
          </UiCard>
        </section>
      </div>

      <div class="space-y-4 lg:sticky lg:top-24">
        <OrderSummary :lines="cart.lines" :total="cart.subtotal" title="Your order" />
        <p v-if="message" role="alert" class="text-meta text-danger">{{ message }}</p>
        <UiButton type="submit" block size="lg" :loading="paying">
          <LockIcon v-if="!paying" aria-hidden="true" />
          {{ paying ? 'Taking payment' : `Pay ${formatMoney(cart.subtotal)}` }}
        </UiButton>
        <p class="text-center text-meta text-muted">
          This is a local demo build. No card is charged and no money moves.
        </p>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ShoppingBagIcon } from 'lucide-vue-next'
import { isApiError } from '@afriff/api'

useHead({ title: 'Cart' })

const api = useApi()
const cart = useCartStore()
const { user } = useAuth()
const { data: products, refresh: refreshCatalog } = useCatalog()

const placing = ref(false)
const message = ref('')

/** The stepper never offers more than the product allows or has left. */
function maxFor(productId: string) {
  const product = products.value?.find((item) => item.id === productId)
  if (!product) return 10
  return Math.max(1, Math.min(product.maxPerOrder, product.remaining ?? product.maxPerOrder))
}

/**
 * Payments are not integrated yet, so checkout completes on the spot: the order
 * goes in under the signed-in account with a card the mock always approves.
 */
async function checkout() {
  if (!user.value) return
  message.value = ''
  placing.value = true
  try {
    const order = await api.orders.checkout({
      items: cart.toCheckoutItems(),
      contact: { name: user.value.name, email: user.value.email, phone: user.value.phone ?? '' },
      payment: { method: 'card', cardName: user.value.name, cardNumber: '4111 1111 1111 1111', expiry: '12/30', cvv: '123' },
    })
    // Leave first, so the cart does not flash its empty state on the way out.
    await navigateTo(`/orders/${order.id}`)
    cart.clear()
    refreshCatalog()
  }
  catch (error) {
    message.value = isApiError(error) ? error.message : 'We could not place that order. Try again.'
  }
  finally {
    placing.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-3xl space-y-6">
    <AppPageHeader title="Cart" :description="cart.isEmpty ? undefined : `${cart.count} ${cart.count === 1 ? 'ticket' : 'tickets'}`" />

    <UiEmptyState
      v-if="cart.isEmpty"
      :icon="ShoppingBagIcon"
      title="Your cart is empty"
      description="Passes, single screenings, masterclasses and gala nights are all on the tickets page."
    >
      <UiButton to="/tickets">Browse tickets</UiButton>
    </UiEmptyState>

    <template v-else>
      <UiCard :padded="false">
        <ul class="divide-y divide-line">
          <li v-for="line in cart.lines" :key="line.key">
            <CartLineRow
              :line="line"
              :max="maxFor(line.productId)"
              @quantity="cart.setQuantity(line.key, $event)"
              @remove="cart.remove(line.key)"
            />
          </li>
        </ul>
        <div class="flex items-center justify-between gap-4 border-t border-line px-4 py-3.5 md:px-5">
          <span class="font-semibold">Total</span>
          <span class="font-display text-h2 font-semibold tabular-nums">{{ formatMoney(cart.subtotal) }}</span>
        </div>
      </UiCard>

      <p v-if="message" role="alert" class="text-meta text-danger">{{ message }}</p>

      <div class="flex flex-wrap items-center justify-between gap-3">
        <UiButton to="/tickets" variant="ghost" :disabled="placing">Keep browsing</UiButton>
        <div class="flex items-center gap-2">
          <UiButton variant="ghost" :disabled="placing" @click="cart.clear()">Clear cart</UiButton>
          <UiButton :loading="placing" @click="checkout">Checkout</UiButton>
        </div>
      </div>
    </template>
  </div>
</template>

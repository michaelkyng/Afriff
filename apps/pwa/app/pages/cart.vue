<script setup lang="ts">
import { ShoppingBagIcon } from 'lucide-vue-next'

useHead({ title: 'Cart' })

const cart = useCartStore()
const { data: products } = useCatalog()

/** The stepper never offers more than the product allows or has left. */
function maxFor(productId: string) {
  const product = products.value?.find((item) => item.id === productId)
  if (!product) return 10
  return Math.max(1, Math.min(product.maxPerOrder, product.remaining ?? product.maxPerOrder))
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

      <div class="flex flex-wrap items-center justify-between gap-3">
        <UiButton to="/tickets" variant="ghost">Keep browsing</UiButton>
        <div class="flex items-center gap-2">
          <UiButton variant="ghost" @click="cart.clear()">Clear cart</UiButton>
          <UiButton to="/checkout">Checkout</UiButton>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { PencilIcon } from 'lucide-vue-next'
import type { TicketProduct } from '@afriff/api/types'

useHead({ title: 'Products' })

const ops = useOps()
const { data: products, refresh } = useAsyncData('ops:products', () => ops.products())
const editing = ref(false)
const target = ref<TicketProduct | null>(null)
function edit(product: TicketProduct) {
  target.value = product
  editing.value = true
}
</script>

<template>
  <div>
    <OpsHeader title="Products" description="What is on sale: price, stock left and how many one order may take." />
    <UiSkeleton v-if="!products" class="h-72 rounded-card" />
    <UiCard v-else :padded="false" class="overflow-x-auto">
      <table class="ops-table">
        <thead>
          <tr><th scope="col">Product</th><th scope="col" class="num">Price</th><th scope="col" class="num">Left to sell</th><th scope="col" class="num">Per order</th><th scope="col"><span class="sr-only">Edit</span></th></tr>
        </thead>
        <tbody>
          <tr v-for="product in products" :key="product.id">
            <td>
              <p class="font-medium">{{ product.name }}</p>
              <p class="text-label text-muted">{{ product.summary }}</p>
            </td>
            <td class="num">{{ formatMoney(product.price) }}</td>
            <td class="num">
              <span :class="product.remaining === 0 && 'font-semibold text-danger'">{{ product.remaining ?? 'No limit' }}</span>
            </td>
            <td class="num">{{ product.maxPerOrder }}</td>
            <td class="text-right"><UiButton size="sm" variant="ghost" @click="edit(product)"><PencilIcon aria-hidden="true" />Edit</UiButton></td>
          </tr>
        </tbody>
      </table>
    </UiCard>
    <p class="mt-3 text-label text-muted">Seats for single screenings come from each screening’s capacity, on the Programme page.</p>
    <ProductSheet v-model:open="editing" :product="target" @done="refresh()" />
  </div>
</template>

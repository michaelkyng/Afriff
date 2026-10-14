<script setup lang="ts">
import type { OpsOrder } from '@afriff/api/ops'

defineProps<{ orders: OpsOrder[] }>()
</script>

<template>
  <UiCard :padded="false" class="overflow-x-auto">
    <table class="ops-table">
      <thead>
        <tr>
          <th scope="col">Order</th>
          <th scope="col">Placed</th>
          <th scope="col">Contact</th>
          <th scope="col">Items</th>
          <th scope="col" class="num">Total</th>
          <th scope="col">Status</th>
        </tr>
      </thead>
      <tbody>
        <OrderRow v-for="order in orders" :key="order.id" :order="order" />
      </tbody>
    </table>
  </UiCard>
</template>

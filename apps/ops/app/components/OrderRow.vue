<script setup lang="ts">
import type { OpsOrder } from '@afriff/api/ops'

/** One order in a table: reference, when, who, what, how much, and where it stands. */
defineProps<{ order: OpsOrder }>()
</script>

<template>
  <tr class="cursor-pointer transition-colors hover:bg-hover" @click="navigateTo(`/orders/${order.id}`)">
    <td class="whitespace-nowrap">
      <NuxtLink :to="`/orders/${order.id}`" class="font-semibold tabular-nums hover:underline" @click.stop>{{ order.reference }}</NuxtLink>
    </td>
    <td class="whitespace-nowrap text-muted tabular-nums">{{ formatDay(order.placedAt) }}, {{ formatTime(order.placedAt) }}</td>
    <td class="min-w-0">
      <p class="truncate font-medium">{{ order.contact.name }}</p>
      <p class="truncate text-label text-muted">{{ order.contact.email }}</p>
    </td>
    <td class="text-muted">{{ order.lines.map((line) => `${line.quantity} × ${line.title}`).join(', ') }}</td>
    <td class="num">{{ formatMoney(order.total) }}</td>
    <td>
      <div class="flex flex-wrap gap-1">
        <UiBadge :tone="ORDER_STATUS[order.status].tone">{{ ORDER_STATUS[order.status].label }}</UiBadge>
        <UiBadge v-if="order.refundDue" tone="accent">Refund due</UiBadge>
        <UiBadge v-else-if="order.refundedAt">Refunded</UiBadge>
      </div>
    </td>
  </tr>
</template>

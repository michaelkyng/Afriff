<script setup lang="ts">
import { ArrowRightIcon } from 'lucide-vue-next'

useHead({ title: 'Overview' })

const ops = useOps()
const { data: overview } = useAsyncData('ops:overview', () => ops.overview())
const { data: refunds } = useAsyncData('ops:refunds', () => ops.orders.refundsDue())
const { data: recent } = useAsyncData('ops:recent', () => ops.orders.recent())
const { data: activity } = useAsyncData('ops:activity', () => ops.audit())
</script>

<template>
  <div>
    <OpsHeader title="Overview" description="Sales so far, and what needs someone." />

    <div class="grid grid-cols-2 gap-3 md:grid-cols-5">
      <template v-if="overview">
        <StatTile label="Paid orders" :value="overview.paidOrders" />
        <StatTile label="Takings" :value="formatMoney(overview.revenue)" />
        <StatTile label="Tickets issued" :value="overview.ticketsIssued" />
        <StatTile label="Waiting for payment" :value="overview.pendingOrders" :to="{ path: '/orders', query: { view: 'pending' } }" />
        <StatTile
          label="Refunds due"
          :value="overview.refundsDue"
          :attention="overview.refundsDue > 0"
          :to="{ path: '/orders', query: { view: 'refunds' } }"
        />
      </template>
      <UiSkeleton v-for="index in 5" v-else :key="index" class="h-24 rounded-card" />
    </div>

    <div class="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <section aria-labelledby="recent-title" class="min-w-0">
        <UiSectionHeader title="Recent orders" title-id="recent-title" />
        <OrderTable v-if="recent" :orders="recent.slice(0, 10)" />
        <UiSkeleton v-else class="h-64 rounded-card" />
      </section>

      <div class="space-y-6">
        <section aria-labelledby="attention-title">
          <UiSectionHeader title="Needs attention" title-id="attention-title" />
          <UiCard v-if="refunds && !refunds.length" class="text-meta text-muted">No refunds waiting.</UiCard>
          <UiCard v-else-if="refunds" :padded="false" class="divide-y divide-line">
            <NuxtLink v-for="order in refunds.slice(0, 5)" :key="order.id" :to="`/orders/${order.id}`" class="row-interactive block px-4 py-3">
              <p class="flex justify-between gap-2 font-semibold tabular-nums">{{ order.reference }} <span>{{ formatMoney(order.total) }}</span></p>
              <p class="text-label text-muted">{{ order.refundReason ?? 'Refund due' }} · {{ order.contact.name }}</p>
            </NuxtLink>
          </UiCard>
        </section>

        <section aria-labelledby="activity-title">
          <UiSectionHeader title="Latest changes" title-id="activity-title" />
          <UiCard v-if="activity && !activity.length" class="text-meta text-muted">Nothing changed in Ops yet.</UiCard>
          <UiCard v-else-if="activity" :padded="false" class="divide-y divide-line">
            <p v-for="entry in activity.slice(0, 6)" :key="entry.id" class="px-4 py-3 text-meta">
              {{ entry.summary }}
              <span class="mt-0.5 block text-label text-muted">{{ entry.byName }}, {{ formatDay(entry.at) }} {{ formatTime(entry.at) }}</span>
            </p>
          </UiCard>
          <NuxtLink to="/activity" class="mt-2 inline-flex items-center gap-1 text-meta font-medium text-muted hover:text-ink">
            All activity
            <ArrowRightIcon class="size-3.5" aria-hidden="true" />
          </NuxtLink>
        </section>
      </div>
    </div>
  </div>
</template>

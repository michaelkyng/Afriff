<script setup lang="ts">
import { isApiError } from '@afriff/api'
import type { OpsOrder } from '@afriff/api/ops'
import { ReceiptIcon, SearchIcon } from 'lucide-vue-next'

useHead({ title: 'Orders' })

const ops = useOps()
const route = useRoute()
const router = useRouter()

type View = 'recent' | 'refunds' | 'pending'
const views = [
  { value: 'recent' as const, label: 'Recent' },
  { value: 'refunds' as const, label: 'Refunds due' },
  { value: 'pending' as const, label: 'Waiting for payment' },
]
const view = computed<View>({
  get: () => (['refunds', 'pending'].includes(String(route.query.view)) ? (route.query.view as View) : 'recent'),
  set: (value) => router.replace({ query: value === 'recent' ? {} : { view: value } }),
})
const { data: listed, status } = useAsyncData('ops:orders', () => (view.value === 'refunds' ? ops.orders.refundsDue() : view.value === 'pending' ? ops.orders.pending() : ops.orders.recent()), { watch: [view] })

const query = ref('')
const results = ref<OpsOrder[] | null>(null)
const searching = ref(false)
const searchError = ref('')

async function search() {
  searchError.value = ''
  if (!query.value.trim()) {
    results.value = null
    return
  }
  searching.value = true
  try {
    results.value = await ops.orders.search(query.value)
    // One match is where they meant to go.
    if (results.value.length === 1) await navigateTo(`/orders/${results.value[0]!.id}`)
  }
  catch (error) {
    searchError.value = isApiError(error) ? error.message : 'That search did not work.'
  }
  finally {
    searching.value = false
  }
}

const shown = computed(() => results.value ?? listed.value ?? [])
</script>

<template>
  <div>
    <OpsHeader title="Orders" description="Find an order by its reference, a ticket code or the buyer’s email." />

    <form class="mb-5 flex flex-wrap items-start gap-2" role="search" @submit.prevent="search">
      <div class="min-w-0 flex-1 basis-72">
        <UiInput v-model="query" label="Search orders" hide-label placeholder="AF-7KQ2P, AF-7KQ2-P4NR or ada@example.com" :error="searchError" />
      </div>
      <UiButton type="submit" :loading="searching" class="h-11">
        <SearchIcon aria-hidden="true" />
        Search
      </UiButton>
      <UiButton v-if="results" variant="ghost" class="h-11" @click="query = ''; results = null">Clear</UiButton>
    </form>

    <div v-if="!results" class="mb-4">
      <UiSegmented v-model="view" :options="views" label="Which orders" />
    </div>
    <p v-else class="mb-4 text-meta text-muted">{{ results.length }} {{ results.length === 1 ? 'order matches' : 'orders match' }} “{{ query }}”.</p>

    <UiSkeleton v-if="!results && !listed && status !== 'error'" class="h-80 rounded-card" />
    <UiEmptyState
      v-else-if="!shown.length"
      :icon="ReceiptIcon"
      :title="results ? 'Nothing matches' : view === 'refunds' ? 'No refunds waiting' : view === 'pending' ? 'Nobody is mid-payment' : 'No orders yet'"
      :description="results ? 'Check the reference or email. Ticket codes look like AF-7KQ2-P4NR.' : undefined"
    />
    <OrderTable v-else :orders="shown" />
  </div>
</template>

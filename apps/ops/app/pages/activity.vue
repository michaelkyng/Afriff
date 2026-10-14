<script setup lang="ts">
import { HistoryIcon } from 'lucide-vue-next'
import type { AuditEntry } from '@afriff/api/ops'

useHead({ title: 'Activity' })

const ops = useOps()
const { data: entries } = useAsyncData('ops:activity', () => ops.audit())

/** Where to see the thing a change was about, when there is a page for it. */
function linkFor(entry: AuditEntry): string | undefined {
  const target = entry.target
  if (!target) return undefined
  if (target.kind === 'screening') return `/programme/${target.id}`
  if (target.kind === 'order') return `/orders/${target.id}`
  if (target.kind === 'update') return '/updates'
  if (target.kind === 'product') return '/products'
  if (target.kind === 'staff') return '/staff'
  return undefined
}
</script>

<template>
  <div>
    <OpsHeader title="Activity" description="Every change made in Ops, newest first. It cannot be edited, here or anywhere else." />
    <UiSkeleton v-if="!entries" class="h-80 rounded-card" />
    <UiEmptyState v-else-if="!entries.length" :icon="HistoryIcon" title="Nothing yet" description="Changes made in Ops appear here, with who made them." />
    <UiCard v-else :padded="false" class="overflow-x-auto">
      <table class="ops-table">
        <thead><tr><th scope="col">When</th><th scope="col">Who</th><th scope="col">What</th></tr></thead>
        <tbody>
          <tr v-for="entry in entries" :key="entry.id">
            <td class="whitespace-nowrap text-muted tabular-nums">{{ formatDay(entry.at) }}, {{ formatTime(entry.at) }}</td>
            <td class="whitespace-nowrap">{{ entry.byName }}</td>
            <td>
              <NuxtLink v-if="linkFor(entry)" :to="linkFor(entry)!" class="hover:underline">{{ entry.summary }}</NuxtLink>
              <span v-else>{{ entry.summary }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </UiCard>
  </div>
</template>

<script setup lang="ts">
import { TicketIcon } from 'lucide-vue-next'

useHead({ title: 'Passes' })
</script>

<template>
  <div class="space-y-8">
    <AppPageHeader
      title="Passes & tickets"
      description="Festival passes, day passes, single screenings, masterclasses and galas."
    />

    <UiEmptyState
      :icon="TicketIcon"
      title="Ticket sales open soon"
      description="The pass catalogue and checkout are the next big piece of this build."
    >
      <UiButton to="/programme" variant="secondary">Browse the programme</UiButton>
    </UiEmptyState>

    <AppPlanned
      feature="F4"
      title="Passes & checkout"
      :items="[
        'Catalogue: Festival Pass, Day Pass, Single Screening, Masterclass, galas',
        'Pick a day, screening or masterclass; cart with limits and sold-out states',
        'Mock checkout with success, failure and pending payments',
      ]"
    />
  </div>
</template>

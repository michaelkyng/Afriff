<script setup lang="ts">
import { WalletCardsIcon } from 'lucide-vue-next'

definePageMeta({ middleware: 'auth' })
useHead({ title: 'Wallet' })

</script>

<template>
  <div class="space-y-8">
    <AppPageHeader title="Wallet" description="Your tickets live here, and they work without data." />

    <UiEmptyState
      :icon="WalletCardsIcon"
      title="No tickets yet"
      description="When you buy a pass or ticket, it shows up here with a QR code for entry."
    >
      <UiButton to="/passes">Get passes</UiButton>
    </UiEmptyState>

    <AppPlanned
      feature="F5"
      title="Wallet & tickets"
      :items="[
        'Upcoming and past tickets with QR codes for entry',
        'Works fully offline once loaded',
        'Add to calendar and transfer a ticket',
      ]"
    />
  </div>
</template>

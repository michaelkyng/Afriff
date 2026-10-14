<script setup lang="ts">
import { ArrowLeftIcon, MailIcon, RefreshCwIcon, TicketXIcon } from 'lucide-vue-next'
import type { OpsTicket } from '@afriff/api/ops'

const route = useRoute()
const id = String(route.params.id)
const ops = useOps()
const { data: detail, error, refresh } = useAsyncData(`ops:order:${id}`, () => ops.orders.get(id))
const order = computed(() => detail.value?.order)

useHead({ title: () => order.value?.reference ?? 'Order' })
watchEffect(() => {
  if (error.value) showError({ statusCode: 404, statusMessage: 'Order not found' })
})

const resend = useOpsAction('resendOrderEmail')
const reissue = useOpsAction('reissueTicket')
const refunding = ref(false)
const voiding = ref(false)
const target = ref<OpsTicket | null>(null)

async function resendEmail() {
  if (await resend.run({ orderId: id }, `Confirmation queued for ${order.value?.contact.email}.`)) refresh()
}

async function reissueTicket(ticket: OpsTicket) {
  if (await reissue.run({ ticketId: ticket.id }, (fresh) => `New code ${fresh.code}. The old one no longer works.`)) refresh()
}

function voidTicket(ticket: OpsTicket) {
  target.value = ticket
  voiding.value = true
}
</script>

<template>
  <div v-if="order && detail">
    <OpsHeader :title="order.reference">
      <template #before>
        <NuxtLink to="/orders" class="mb-2 inline-flex items-center gap-1 text-meta font-medium text-muted hover:text-ink">
          <ArrowLeftIcon class="size-3.5" aria-hidden="true" />
          Orders
        </NuxtLink>
      </template>
      <template #description>
        <span class="tabular-nums">{{ formatMoney(order.total) }}</span> · placed {{ formatDay(order.placedAt) }}, {{ formatTime(order.placedAt) }}
        <UiBadge :tone="ORDER_STATUS[order.status].tone" class="ml-1.5 align-middle">{{ ORDER_STATUS[order.status].label }}</UiBadge>
      </template>
      <UiButton v-if="order.status === 'paid'" variant="secondary" :loading="resend.pending.value" @click="resendEmail">
        <MailIcon aria-hidden="true" />
        Resend confirmation
      </UiButton>
    </OpsHeader>

    <p v-for="message in [resend.error.value, reissue.error.value].filter(Boolean)" :key="message" role="alert" class="mb-3 text-meta text-danger">{{ message }}</p>

    <UiCard v-if="order.refundDue" class="mb-6 flex flex-wrap items-center gap-4 border-accent/45">
      <div class="min-w-0 flex-1 basis-72">
        <p class="font-semibold text-accent-ink">Refund due: {{ formatMoney(order.total) }}</p>
        <p class="text-meta text-muted">{{ order.refundReason ?? 'Money landed without tickets being issued.' }}</p>
      </div>
      <UiButton @click="refunding = true">Mark refunded</UiButton>
    </UiCard>
    <UiCard v-else-if="order.refundedAt" class="mb-6 text-meta">
      <span class="font-semibold">Refunded</span> {{ formatDay(order.refundedAt) }}, {{ formatTime(order.refundedAt) }}<template v-if="order.refundNote">: {{ order.refundNote }}</template>
    </UiCard>

    <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div class="min-w-0 space-y-6">
        <section aria-labelledby="tickets-title">
          <UiSectionHeader title="Tickets" title-id="tickets-title" :meta="String(detail.tickets.length)" />
          <UiCard v-if="!detail.tickets.length" class="text-meta text-muted">
            {{ order.status === 'paid' ? 'No tickets on this order.' : 'Tickets are issued once it is paid.' }}
          </UiCard>
          <UiCard v-else :padded="false" class="overflow-x-auto">
            <table class="ops-table">
              <thead><tr><th scope="col">Ticket</th><th scope="col">Holder</th><th scope="col">Code</th><th scope="col">Status</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead>
              <tbody>
                <tr v-for="ticket in detail.tickets" :key="ticket.id">
                  <td>
                    <p class="font-medium">{{ ticket.title }}</p>
                    <p v-if="ticket.subtitle" class="text-label text-muted">{{ ticket.subtitle }}</p>
                  </td>
                  <td>{{ ticket.holderName }}</td>
                  <td class="whitespace-nowrap tabular-nums">{{ ticket.code }}</td>
                  <td>
                    <UiBadge :tone="TICKET_STATUS[ticket.status].tone">{{ TICKET_STATUS[ticket.status].label }}</UiBadge>
                    <p v-if="ticket.voidReason" class="mt-1 max-w-56 text-label text-muted">{{ ticket.voidReason }}</p>
                    <p v-if="ticket.usedAt" class="mt-1 text-label text-muted">In at {{ formatTime(ticket.usedAt) }}, {{ formatDay(ticket.usedAt) }}</p>
                  </td>
                  <td class="text-right whitespace-nowrap">
                    <template v-if="ticket.status === 'valid'">
                      <UiButton size="sm" variant="ghost" :loading="reissue.pending.value" @click="reissueTicket(ticket)">
                        <RefreshCwIcon aria-hidden="true" />
                        New code
                      </UiButton>
                      <UiButton size="sm" variant="ghost" @click="voidTicket(ticket)">
                        <TicketXIcon aria-hidden="true" />
                        Void
                      </UiButton>
                    </template>
                  </td>
                </tr>
              </tbody>
            </table>
          </UiCard>
        </section>

        <section aria-labelledby="lines-title">
          <UiSectionHeader title="What was bought" title-id="lines-title" />
          <UiCard :padded="false">
            <table class="ops-table">
              <tbody>
                <tr v-for="line in order.lines" :key="line.id">
                  <td>
                    <p class="font-medium">{{ line.title }}</p>
                    <p class="text-label text-muted">{{ line.detail ? `${line.detail} · ` : '' }}{{ line.quantity }} × {{ formatMoney(line.unitPrice) }}</p>
                  </td>
                  <td class="num font-medium">{{ formatMoney({ amount: line.unitPrice.amount * line.quantity, currency: 'NGN' }) }}</td>
                </tr>
                <tr>
                  <td class="font-semibold">Total</td>
                  <td class="num font-semibold">{{ formatMoney(order.total) }}</td>
                </tr>
              </tbody>
            </table>
          </UiCard>
        </section>
      </div>

      <div class="space-y-6">
        <section aria-labelledby="who-title">
          <UiSectionHeader title="Buyer" title-id="who-title" />
          <UiCard class="space-y-1 text-meta">
            <p class="font-semibold">{{ order.contact.name }}</p>
            <p><a :href="`mailto:${order.contact.email}`" class="hover:underline">{{ order.contact.email }}</a></p>
            <p v-if="order.contact.phone" class="tabular-nums">{{ order.contact.phone }}</p>
          </UiCard>
        </section>

        <section aria-labelledby="payment-title">
          <UiSectionHeader title="Payment" title-id="payment-title" />
          <UiCard class="space-y-1 text-meta">
            <p>{{ formatPaymentMethod(order.payment) }}</p>
            <p v-if="order.payment.reference" class="text-muted tabular-nums">Paystack reference {{ order.payment.reference }}</p>
            <p v-if="order.paidAt" class="text-muted">Paid {{ formatDay(order.paidAt) }}, {{ formatTime(order.paidAt) }}</p>
            <p v-if="order.payment.failureReason" class="text-danger">{{ order.payment.failureReason }}</p>
            <p v-if="order.duplicatePayments?.length" class="text-accent-ink">Also paid: {{ order.duplicatePayments.join(', ') }}</p>
          </UiCard>
        </section>

        <section aria-labelledby="mail-title">
          <UiSectionHeader title="Emails" title-id="mail-title" />
          <UiCard v-if="!detail.mail.length" class="text-meta text-muted">None sent for this order.</UiCard>
          <UiCard v-else :padded="false" class="divide-y divide-line">
            <div v-for="mail in detail.mail" :key="mail.id" class="px-4 py-2.5 text-meta">
              <p class="flex justify-between gap-2">
                <span class="font-medium">{{ MAIL_TEMPLATE[mail.template] ?? mail.template }}</span>
                <UiBadge :tone="mail.status === 'sent' ? 'success' : mail.status === 'failed' ? 'danger' : 'neutral'">{{ mail.status }}</UiBadge>
              </p>
              <p class="text-label text-muted">{{ mail.to }} · {{ formatDay(mail.createdAt) }}, {{ formatTime(mail.createdAt) }}</p>
              <p v-if="mail.error" class="text-label text-danger">{{ mail.error }}</p>
            </div>
          </UiCard>
        </section>
      </div>
    </div>

    <RefundSheet v-model:open="refunding" :order="order" @done="refresh()" />
    <VoidTicketSheet v-model:open="voiding" :ticket="target" @done="refresh()" />
  </div>
  <UiSkeleton v-else class="h-96 rounded-card" />
</template>

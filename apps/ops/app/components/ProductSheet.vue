<script setup lang="ts">
import type { TicketProduct } from '@afriff/api/types'

/** Price, stock left to sell and the per-order limit. A sale at the same moment is not lost. */
const props = defineProps<{ product: TicketProduct | null }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ done: [] }>()

const form = reactive({ price: '', remaining: '', limit: '' })
const { run, pending, errorFor, formError } = useOpsAction('updateProduct')

watch(open, (value) => {
  if (!value || !props.product) return
  form.price = String(props.product.price.amount / 100)
  form.remaining = props.product.remaining === null ? '' : String(props.product.remaining)
  form.limit = String(props.product.maxPerOrder)
})

async function submit() {
  if (!props.product) return
  const done = await run({
    productId: props.product.id,
    priceNaira: Number(form.price),
    remaining: form.remaining.trim() === '' ? null : Number(form.remaining),
    maxPerOrder: Number(form.limit),
  }, `${props.product.name} saved.`)
  if (done) {
    open.value = false
    emit('done')
  }
}
</script>

<template>
  <UiSheet v-model:open="open" :title="product?.name ?? 'Product'">
    <form v-if="product" class="space-y-4" novalidate @submit.prevent="submit">
      <UiInput v-model="form.price" label="Price (naira)" type="number" inputmode="numeric" hint="Orders already placed keep the price they were placed at." :error="errorFor('priceNaira')" :disabled="pending" />
      <UiInput v-model="form.remaining" label="Left to sell" type="number" inputmode="numeric" hint="Leave empty for no limit. This is what is left now, not the original allocation." :error="errorFor('remaining')" :disabled="pending" />
      <UiInput v-model="form.limit" label="Most per order" type="number" inputmode="numeric" :error="errorFor('maxPerOrder')" :disabled="pending" />
      <p v-if="formError(['priceNaira', 'remaining', 'maxPerOrder'])" role="alert" class="text-meta text-danger">{{ formError(['priceNaira', 'remaining', 'maxPerOrder']) }}</p>
      <UiButton type="submit" block :loading="pending">Save</UiButton>
    </form>
  </UiSheet>
</template>

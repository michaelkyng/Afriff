<script setup lang="ts">
import type { ScreeningChange } from '@afriff/api/ops'
import type { Screening, Venue } from '@afriff/api/types'

/** A new time or screen for a screening. It keeps its length; its tickets follow it. */
const props = defineProps<{ screening: Screening; venues: Venue[]; title: string }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ moved: [change: ScreeningChange] }>()

const startsAt = ref('')
const screenId = ref('')
const { run, pending, errorFor, formError } = useOpsAction('moveScreening')

watch(open, (value) => {
  if (!value) return
  startsAt.value = toLagosInput(props.screening.startsAt)
  screenId.value = props.screening.screenId
})

const screens = computed(() =>
  props.venues.flatMap((venue) => venue.screens.map((screen) => ({ value: screen.id, label: `${venue.shortName}, ${screen.name} (${screen.capacity} seats)` }))),
)
const length = computed(() => Date.parse(props.screening.endsAt) - Date.parse(props.screening.startsAt))
const endsAt = computed(() => (startsAt.value ? formatTime(new Date(Date.parse(fromLagosInput(startsAt.value)) + length.value)) : ''))

async function submit() {
  const change = await run({ screeningId: props.screening.id, startsAt: fromLagosInput(startsAt.value), screenId: screenId.value },
    (output) => `Moved. ${output.ticketsAffected} ${output.ticketsAffected === 1 ? 'ticket follows' : 'tickets follow'} it.`)
  if (!change) return
  open.value = false
  emit('moved', change)
}
</script>

<template>
  <UiSheet v-model:open="open" :title="`Move ${title}`">
    <form class="space-y-4" novalidate @submit.prevent="submit">
      <UiInput v-model="startsAt" label="Starts (Lagos time)" type="datetime-local" :hint="endsAt ? `Ends at ${endsAt}, keeping its length.` : undefined" :error="errorFor('startsAt')" :disabled="pending" />
      <UiSelect v-model="screenId" label="Screen" :options="screens" :error="errorFor('screenId')" :disabled="pending" />
      <p class="text-meta text-pretty text-muted">
        Every ticket for it takes the new time and place, including on phones that are offline until they next connect.
        Next, you can tell the people holding them.
      </p>
      <p v-if="formError(['startsAt', 'screenId'])" role="alert" class="text-meta text-danger">{{ formError(['startsAt', 'screenId']) }}</p>
      <UiButton type="submit" block :loading="pending">Move screening</UiButton>
    </form>
  </UiSheet>
</template>

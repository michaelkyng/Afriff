<script setup lang="ts">
import { BookmarkIcon } from 'lucide-vue-next'
import type { SavedKind } from '@afriff/api'

/**
 * Puts something on the attendee's plan, or takes it off.
 *
 * Works signed out — the device keeps the list until there is an account to
 * keep it for. The icon fills the moment it is pressed; the account catches up
 * behind it.
 */
const props = withDefaults(
  defineProps<{
    kind: SavedKind
    refId: string
    /** What this is, for the label a screen reader reads: "Salt Roads". */
    name: string
    /** `icon` is the round button on cards; `button` is the labelled one on a detail page. */
    variant?: 'icon' | 'button'
    size?: 'sm' | 'md'
  }>(),
  { variant: 'icon', size: 'md' },
)

const plan = usePlanStore()
const saved = computed(() => plan.has(props.kind, props.refId))
const busy = ref(false)

const verb = computed(() => (props.kind === 'film' ? 'watchlist' : 'plan'))
const label = computed(() => (saved.value ? `Remove ${props.name} from your ${verb.value}` : `Add ${props.name} to your ${verb.value}`))

async function press() {
  if (busy.value) return
  busy.value = true
  try {
    await plan.toggle(props.kind, props.refId)
  }
  catch {
    // The store has already put the list back; nothing more to say here.
  }
  finally {
    busy.value = false
  }
}
</script>

<template>
  <button
    v-if="variant === 'icon'"
    type="button"
    class="pressable grid shrink-0 place-items-center rounded-full border transition-[background-color,border-color,color] duration-160 ease-out"
    :class="[
      size === 'sm' ? 'size-8' : 'size-9',
      saved
        ? 'border-accent bg-accent-soft text-accent-ink'
        : 'border-line bg-surface text-muted hover:border-line-strong hover:text-ink',
    ]"
    :aria-pressed="saved"
    :aria-label="label"
    :title="label"
    @click.stop.prevent="press"
  >
    <BookmarkIcon :class="size === 'sm' ? 'size-4' : 'size-4.5'" :fill="saved ? 'currentColor' : 'none'" />
  </button>

  <UiButton v-else variant="secondary" :size="size" :aria-pressed="saved" @click="press">
    <BookmarkIcon aria-hidden="true" :fill="saved ? 'currentColor' : 'none'" />
    {{ saved ? 'Saved' : kind === 'film' ? 'Save film' : 'Add to my plan' }}
  </UiButton>
</template>

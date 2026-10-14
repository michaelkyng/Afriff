<script setup lang="ts">
import { CheckIcon, TriangleAlertIcon, WifiOffIcon, XIcon } from 'lucide-vue-next'
import type { CheckInResult, DoorSession } from '@afriff/api/door'
import type { OutcomeTone } from '~/utils/outcomes'

/**
 * The verdict, filling the screen in a colour that reads from across a lobby:
 * green to let them in, gold for a second look, red to stop. A good result
 * clears itself; anything else waits for "Next" so it is read.
 *
 * `failure` is for when the scan could not be checked at all (no connection).
 */
const props = defineProps<{ result: CheckInResult | null; failure: string; session: DoorSession }>()
const emit = defineEmits<{ next: []; retry: [] }>()

/** How long a good result stays up before the next scan. */
const CLEAR_MS = 1600

const copy = computed(() => (props.result ? describeOutcome(props.result, props.session) : null))
const tone = computed<OutcomeTone | null>(() => (props.failure ? 'bad' : copy.value?.tone ?? null))
const visible = computed(() => Boolean(props.result || props.failure))

const surfaces: Record<OutcomeTone, string> = {
  good: 'bg-success text-canvas',
  warn: 'bg-accent text-on-accent',
  bad: 'bg-danger text-canvas',
}

const nextButton = useTemplateRef<HTMLButtonElement>('nextButton')
let timer: ReturnType<typeof setTimeout> | undefined

watch(visible, async (shown) => {
  clearTimeout(timer)
  if (!shown) return
  if (copy.value && !copy.value.hold && !props.failure) timer = setTimeout(() => emit('next'), CLEAR_MS)
  await nextTick()
  nextButton.value?.focus()
})

onBeforeUnmount(() => clearTimeout(timer))

function tapAnywhere() {
  // A good result can be waved through early; the others want the button, so a stray tap does not skip them.
  if (copy.value && !copy.value.hold && !props.failure) emit('next')
}
</script>

<template>
  <Transition
    enter-active-class="transition duration-150 ease-out motion-reduce:transition-none"
    enter-from-class="opacity-0 scale-[0.98]"
    leave-active-class="transition duration-100 ease-out motion-reduce:transition-none"
    leave-to-class="opacity-0"
  >
    <div
      v-if="visible && tone"
      class="fixed inset-0 z-50 flex flex-col px-6 pt-safe pb-safe"
      :class="surfaces[tone]"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="scan-result-title"
      aria-describedby="scan-result-detail"
      @click="tapAnywhere"
      @keydown.esc="emit('next')"
    >
      <div class="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-8">
        <span class="mb-6 grid size-16 place-items-center rounded-full bg-black/12" aria-hidden="true">
          <WifiOffIcon v-if="failure" class="size-8" />
          <CheckIcon v-else-if="tone === 'good'" class="size-9" stroke-width="2.75" />
          <TriangleAlertIcon v-else-if="tone === 'warn'" class="size-8" />
          <XIcon v-else class="size-9" stroke-width="2.75" />
        </span>

        <h2 id="scan-result-title" class="font-display text-display font-semibold text-balance">
          {{ failure ? 'Could not check that ticket' : copy?.title }}
        </h2>

        <template v-if="result?.ticket">
          <p class="mt-5 text-h1 font-semibold text-balance">{{ result.ticket.holderName }}</p>
          <p class="mt-1 text-prose opacity-80">
            {{ result.ticket.title }}<template v-if="result.ticket.title !== result.ticket.productName"> · {{ result.ticket.productName }}</template>
          </p>
        </template>

        <p id="scan-result-detail" class="mt-4 text-prose text-pretty">{{ failure || copy?.detail }}</p>
      </div>

      <div class="mx-auto w-full max-w-md pb-6">
        <div v-if="!failure && copy && !copy.hold" class="h-1 overflow-hidden rounded-full bg-black/15" aria-hidden="true">
          <div class="h-full origin-left rounded-full bg-black/40 [animation:clear-bar_1600ms_linear_forwards] motion-reduce:hidden" />
        </div>
        <div v-else class="grid gap-2">
          <button
            v-if="failure"
            ref="nextButton"
            type="button"
            class="pressable h-14 rounded-full bg-canvas text-prose font-semibold text-ink"
            @click.stop="emit('retry')"
          >
            Try again
          </button>
          <button
            :ref="failure ? undefined : 'nextButton'"
            type="button"
            class="pressable h-14 rounded-full text-prose font-semibold"
            :class="failure ? 'bg-black/12' : 'bg-canvas text-ink'"
            @click.stop="emit('next')"
          >
            {{ failure ? 'Cancel' : 'Next ticket' }}
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
@keyframes clear-bar {
  from {
    transform: scaleX(0);
  }
  to {
    transform: scaleX(1);
  }
}
</style>

<script setup lang="ts">
import { ArrowLeftIcon, KeyboardIcon, LoaderCircleIcon, TicketIcon, Volume2Icon, VolumeXIcon } from 'lucide-vue-next'
import { isApiError } from '@afriff/api'
import { NO_COUNT } from '@afriff/api/door'
import type { CheckInResult, DoorCount, SessionKind, SessionRef } from '@afriff/api/door'
import type CameraView from '~/components/CameraView.vue'
import type { OutcomeTone } from '~/utils/outcomes'

const route = useRoute()
const kind = route.params.kind
if (kind !== 'screening' && kind !== 'event') throw createError({ statusCode: 404, statusMessage: 'No such door' })
const target: SessionRef = { kind: kind as SessionKind, id: String(route.params.id) }

const door = useDoor()
const clock = useDoorClock()
const feedback = useFeedback()
const { $doorDemo } = useNuxtApp()
const { data: sessions, status } = useDoorSessions()
const session = computed(() => sessions.value.find((item) => item.ref.kind === target.kind && item.ref.id === target.id))

useHead({ title: () => session.value?.title ?? 'Door' })

watchEffect(() => {
  if (status.value === 'success' && !session.value) showError({ statusCode: 404, statusMessage: 'That screening or event is not in the programme' })
})

// A scanner that dims and locks mid-queue costs a minute each time.
const wakeLock = useWakeLock()
onMounted(() => wakeLock.isSupported.value && wakeLock.request('screen').catch(() => {}))

// ---------------------------------------------------------------- the count

const count = ref<DoorCount>({ ...NO_COUNT })
let stopWatching: (() => void) | undefined
onMounted(() => {
  stopWatching = door.watchCount(target, (latest) => {
    count.value = latest
  })
})
onBeforeUnmount(() => stopWatching?.())

// ---------------------------------------------------------------- scanning

interface Recent {
  at: string
  name: string
  title: string
  tone: OutcomeTone
}

const camera = useTemplateRef<InstanceType<typeof CameraView>>('camera')
const result = ref<CheckInResult | null>(null)
const failure = ref('')
const checking = ref(false)
/** This device's last few scans here, for when someone comes back asking. Memory only. */
const recent = ref<Recent[]>([])

/** The camera sees the same code many times a second; one read is enough. */
let last = { text: '', at: 0 }
let pending = ''

async function check(text: string) {
  if (checking.value || result.value || failure.value || !session.value) return
  if (text === last.text && Date.now() - last.at < 4000) return
  last = { text, at: Date.now() }
  pending = text
  checking.value = true
  camera.value?.pause()
  try {
    const checked = await door.checkIn({ session: target, scan: text, at: clock.at() })
    const copy = describeOutcome(checked, session.value)
    result.value = checked
    // The live count may already be ahead from other doors; never step it back.
    if (checked.count.admitted >= count.value.admitted) count.value = checked.count
    recent.value = [{ at: checked.at, name: checked.ticket?.holderName ?? 'Unknown code', title: copy.title, tone: copy.tone }, ...recent.value].slice(0, 20)
    feedback.signal(copy.tone)
  }
  catch (error) {
    failure.value = isApiError(error) ? error.message : 'Something went wrong. Try again.'
    feedback.signal('bad')
  }
  finally {
    checking.value = false
  }
}

function next() {
  result.value = null
  failure.value = ''
  camera.value?.resume()
}

function retry() {
  failure.value = ''
  last = { text: '', at: 0 }
  check(pending)
}

/** A typed code or a demo ticket is meant, even when it repeats the last one. */
function checkNow(text: string) {
  last = { text: '', at: 0 }
  check(text)
}

const codeOpen = ref(false)
const demoOpen = ref(false)
const demoTickets = computed(() => ($doorDemo ? $doorDemo(target) : []))

// While a sheet is open the camera stops reading, so nobody is admitted behind it.
watch([codeOpen, demoOpen], ([code, demo]) => {
  if (code || demo) camera.value?.pause()
  else if (!result.value && !failure.value) camera.value?.resume()
})

const dot: Record<OutcomeTone, string> = { good: 'bg-success', warn: 'bg-accent', bad: 'bg-danger' }
</script>

<template>
  <div class="mx-auto flex h-dvh w-full max-w-md flex-col pt-safe pb-safe" @pointerdown="feedback.prime()">
    <header class="flex items-center gap-1.5 px-2 py-2">
      <UiButton to="/" variant="ghost" size="sm" aria-label="Choose another door" class="size-10 px-0">
        <ArrowLeftIcon aria-hidden="true" />
      </UiButton>
      <div class="min-w-0 flex-1">
        <p class="truncate font-semibold">{{ session?.title ?? 'Loading' }}</p>
        <p v-if="session" class="truncate text-label text-muted tabular-nums">{{ formatTime(session.startsAt) }} · {{ session.place }}</p>
      </div>
      <p
        v-if="session"
        class="shrink-0 rounded-full border border-line bg-surface px-3 py-1.5 font-display text-h3 font-semibold tabular-nums"
        aria-live="polite"
        :aria-label="session.capacity === null ? `${count.admitted} admitted` : `${count.admitted} admitted of ${session.capacity} seats`"
      >
        {{ countLabel(count, session) }}
      </p>
    </header>

    <p v-if="clock.rehearsing.value" class="mx-3 mb-2 rounded-tag bg-accent-soft px-2.5 py-1 text-label font-medium text-accent-ink tabular-nums">
      Rehearsal clock: {{ formatDay(clock.now.value) }}, {{ formatTime(clock.now.value) }}
    </p>

    <div class="relative min-h-0 flex-1 px-3">
      <CameraView ref="camera" class="h-full" @code="check" />
      <div v-if="checking" class="absolute inset-x-3 inset-y-0 grid place-items-center rounded-card bg-black/45" role="status">
        <span class="flex items-center gap-2 rounded-full bg-surface px-4 py-2 font-medium">
          <LoaderCircleIcon class="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          Checking
        </span>
      </div>
    </div>

    <section v-if="recent.length" class="px-4 pt-3" aria-label="Recent scans on this device">
      <ul class="space-y-1">
        <li v-for="item in recent.slice(0, 3)" :key="item.at" class="flex items-center gap-2.5 text-meta">
          <span class="size-2 shrink-0 rounded-full" :class="dot[item.tone]" aria-hidden="true" />
          <span class="min-w-0 flex-1 truncate"><span class="font-medium">{{ item.name }}</span><span class="ml-1.5 text-muted">{{ item.title }}</span></span>
          <span class="shrink-0 text-label text-muted tabular-nums">{{ formatTime(item.at) }}</span>
        </li>
      </ul>
    </section>

    <footer class="flex gap-2 px-3 pt-3 pb-3">
      <UiButton size="lg" variant="secondary" class="flex-1" @click="codeOpen = true">
        <KeyboardIcon aria-hidden="true" />
        Type a code
      </UiButton>
      <UiButton v-if="$doorDemo" size="lg" variant="secondary" @click="demoOpen = true">
        <TicketIcon aria-hidden="true" />
        Demo
      </UiButton>
      <UiButton
        size="lg"
        variant="ghost"
        class="w-12 px-0"
        :aria-label="feedback.muted.value ? 'Turn sound on' : 'Turn sound off'"
        :aria-pressed="!feedback.muted.value"
        @click="feedback.muted.value = !feedback.muted.value"
      >
        <VolumeXIcon v-if="feedback.muted.value" aria-hidden="true" />
        <Volume2Icon v-else aria-hidden="true" />
      </UiButton>
    </footer>

    <ScanResult v-if="session" :result="result" :failure="failure" :session="session" @next="next" @retry="retry" />
    <CodeEntrySheet v-model:open="codeOpen" @submit="checkNow" />
    <DemoTicketsSheet v-if="$doorDemo" v-model:open="demoOpen" :tickets="demoTickets" @scan="checkNow" />
  </div>
</template>

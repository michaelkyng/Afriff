<script setup lang="ts">
import { CameraOffIcon, FlashlightIcon, FlashlightOffIcon } from 'lucide-vue-next'

/** The back camera, reading QR codes. Says plainly when it cannot, and points at typing the code instead. */
const emit = defineEmits<{ code: [text: string] }>()

const video = useTemplateRef<HTMLVideoElement>('video')
const scanner = useQrScanner(video, (text) => emit('code', text))
const { state, torchSupported, torchOn } = scanner

onMounted(() => scanner.start())

defineExpose({ pause: scanner.pause, resume: scanner.resume })

const problem = computed(() => ({
  idle: null,
  starting: null,
  running: null,
  denied: { title: 'The camera is blocked', body: 'Allow the camera for this site in the browser’s settings, then try again. You can type codes meanwhile.' },
  unavailable: { title: 'No camera to use', body: 'This device has no camera, or the page is not secure (https). Type the codes instead.' },
  error: { title: 'The camera did not start', body: 'Another app may be using it. Close that, then try again.' },
}[state.value]))
</script>

<template>
  <div class="relative isolate overflow-hidden rounded-card bg-black">
    <video ref="video" class="absolute inset-0 size-full object-cover" playsinline muted autoplay aria-hidden="true" />

    <!-- Where to hold the ticket -->
    <div v-if="state === 'running'" class="pointer-events-none absolute inset-0 grid place-items-center" aria-hidden="true">
      <div class="relative aspect-square w-[64%] max-w-72">
        <span class="absolute top-0 left-0 size-9 rounded-tl-tile border-t-4 border-l-4 border-accent" />
        <span class="absolute top-0 right-0 size-9 rounded-tr-tile border-t-4 border-r-4 border-accent" />
        <span class="absolute bottom-0 left-0 size-9 rounded-bl-tile border-b-4 border-l-4 border-accent" />
        <span class="absolute right-0 bottom-0 size-9 rounded-br-tile border-r-4 border-b-4 border-accent" />
      </div>
    </div>

    <p v-if="state === 'starting' || state === 'idle'" class="absolute inset-0 grid place-items-center text-meta text-white/70">
      Starting the camera
    </p>

    <div v-else-if="problem" class="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-surface p-6 text-center" role="status">
      <CameraOffIcon class="size-8 text-subtle" aria-hidden="true" />
      <p class="font-semibold">{{ problem.title }}</p>
      <p class="max-w-64 text-meta text-pretty text-muted">{{ problem.body }}</p>
      <UiButton v-if="state !== 'unavailable'" size="sm" variant="secondary" @click="scanner.start()">Try again</UiButton>
    </div>

    <button
      v-if="state === 'running' && torchSupported"
      type="button"
      class="pressable absolute right-3 bottom-3 grid size-11 place-items-center rounded-full bg-black/55 text-white backdrop-blur-sm"
      :aria-label="torchOn ? 'Turn the light off' : 'Turn the light on'"
      :aria-pressed="torchOn"
      @click="scanner.setTorch(!torchOn)"
    >
      <FlashlightOffIcon v-if="torchOn" class="size-5" aria-hidden="true" />
      <FlashlightIcon v-else class="size-5" aria-hidden="true" />
    </button>
  </div>
</template>

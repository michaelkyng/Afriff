import type { Ref } from 'vue'

export type CameraState = 'idle' | 'starting' | 'running' | 'denied' | 'unavailable' | 'error'

/** How often a frame is read. Fast enough to feel instant, slow enough to spare the battery. */
const FRAME_MS = 120

type Detect = (video: HTMLVideoElement) => Promise<string | null>

async function jsqrDetector(): Promise<Detect> {
  const { default: jsQR } = await import('jsqr')
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d', { willReadFrequently: true })!
  return async (video) => {
    const scale = Math.min(1, 720 / Math.max(video.videoWidth, 1))
    canvas.width = Math.round(video.videoWidth * scale)
    canvas.height = Math.round(video.videoHeight * scale)
    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    const frame = context.getImageData(0, 0, canvas.width, canvas.height)
    return jsQR(frame.data, frame.width, frame.height, { inversionAttempts: 'dontInvert' })?.data ?? null
  }
}

/**
 * jsQR from the first frame, and the browser's own detector once it is ready.
 *
 * The native one (Chrome on Android, which most door phones will be) copes
 * better with glare, blur and worn printouts, but its first call loads a model,
 * which was measured at five seconds. So it warms up in the background while
 * jsQR reads, and takes over when warm. Safari has none, and stays on jsQR.
 */
async function createDetector(): Promise<Detect> {
  const fallback = await jsqrDetector()
  let native: Detect | null = null

  const Native = window.BarcodeDetector
  if (Native) {
    Native.getSupportedFormats()
      .then(async (formats) => {
        if (!formats.includes('qr_code')) return
        const detector = new Native({ formats: ['qr_code'] })
        const blank = document.createElement('canvas')
        blank.width = blank.height = 64
        await detector.detect(blank)
        native = async (video) => (await detector.detect(video))[0]?.rawValue ?? null
      })
      .catch(() => {})
  }

  return (video) => (native ? native(video).catch(() => fallback(video)) : fallback(video))
}

/**
 * Reads QR codes from the back camera into `onCode`. The camera stops while the
 * page is hidden, so a phone left in a pocket is not filming, and `pause` stops
 * reading while a result is on screen without turning the camera off.
 */
export function useQrScanner(video: Ref<HTMLVideoElement | null>, onCode: (text: string) => void) {
  const state = ref<CameraState>('idle')
  const torchSupported = ref(false)
  const torchOn = ref(false)

  let stream: MediaStream | null = null
  let detect: Detect | null = null
  let timer: ReturnType<typeof setTimeout> | undefined
  let paused = false
  let wanted = false

  const track = () => stream?.getVideoTracks()[0]

  function loop() {
    timer = setTimeout(async () => {
      const element = video.value
      if (!stream || !element) return
      if (!paused && detect && element.readyState >= element.HAVE_CURRENT_DATA) {
        const text = await detect(element).catch(() => null)
        if (text && !paused && stream) onCode(text)
      }
      loop()
    }, FRAME_MS)
  }

  async function start() {
    wanted = true
    if (stream || state.value === 'starting') return
    // Cameras need a secure page: https, or localhost.
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      state.value = 'unavailable'
      return
    }
    state.value = 'starting'
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
      })
    }
    catch (error) {
      const name = (error as DOMException).name
      state.value = name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : name === 'NotFoundError' ? 'unavailable' : 'error'
      return
    }
    // Left the page while the permission prompt was up.
    if (!wanted) {
      stop()
      return
    }
    const element = video.value!
    element.srcObject = stream
    await element.play().catch(() => {})
    const capabilities = (track()?.getCapabilities?.() ?? {}) as MediaTrackCapabilities & { torch?: boolean }
    torchSupported.value = Boolean(capabilities.torch)
    detect ??= await createDetector()
    state.value = 'running'
    loop()
  }

  function stop() {
    clearTimeout(timer)
    stream?.getTracks().forEach((item) => item.stop())
    stream = null
    torchOn.value = false
    if (video.value) video.value.srcObject = null
    if (state.value === 'running' || state.value === 'starting') state.value = 'idle'
  }

  async function setTorch(on: boolean) {
    await track()?.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] }).catch(() => {})
    torchOn.value = on
  }

  const visibility = useDocumentVisibility()
  watch(visibility, (current) => {
    if (current === 'hidden') {
      const keep = wanted
      stop()
      wanted = keep
    }
    else if (wanted) start()
  })

  onBeforeUnmount(() => {
    wanted = false
    stop()
  })

  return {
    state,
    torchSupported,
    torchOn,
    start,
    stop,
    setTorch,
    pause: () => (paused = true),
    resume: () => (paused = false),
  }
}

/**
 * The clock the door judges by. Normally the real one. For rehearsals, staff can
 * set it to a moment in festival week, but only where the API honours it: the
 * mock, and the Firebase emulators. A deployed server always uses its own clock,
 * so the control is not offered against one.
 */
export const useDoorClock = createSharedComposable(() => {
  const config = useRuntimeConfig().public
  const available = config.apiMode === 'mock' || Boolean(config.firebase.emulatorHost)
  /** How far the rehearsal clock is from the real one, in ms. 0 is real time. */
  const offset = useLocalStorage('afriff-door:clock-offset', 0)
  const rehearsing = computed(() => available && offset.value !== 0)
  /** One clock for the whole app, so every screen agrees on the minute. */
  const tick = ref(Date.now())
  useIntervalFn(() => (tick.value = Date.now()), 15_000)
  const now = computed(() => new Date(tick.value + (rehearsing.value ? offset.value : 0)))

  /** Sets the rehearsal clock to a moment, or back to real time with null. */
  function rehearseAt(moment: string | null) {
    tick.value = Date.now()
    offset.value = moment ? Date.parse(moment) - tick.value : 0
  }

  /** What to send with a scan: the rehearsal time, or nothing for the real one. */
  function at(): string | undefined {
    return rehearsing.value ? new Date(Date.now() + offset.value).toISOString() : undefined
  }

  return { available, rehearsing, now, rehearseAt, at }
})

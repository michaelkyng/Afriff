import type { Festival } from '@afriff/api'

export type FestivalPhase = 'before' | 'during' | 'after'

/**
 * The festival clock: where "now" sits relative to the festival.
 * In development, `prefs.devNow` can pin the clock to any moment so we can
 * preview festival-week states outside November.
 */
export function useFestivalClock(festival: MaybeRefOrGetter<Festival | null | undefined>) {
  const prefs = usePrefsStore()
  // Tick once a second (the default scheduler would update every animation frame).
  const realNow = useNow({ scheduler: (cb) => useIntervalFn(cb, 1000) })

  const now = computed(() => (prefs.devNow ? new Date(prefs.devNow) : realNow.value))
  const isSimulated = computed(() => Boolean(prefs.devNow))

  const phase = computed<FestivalPhase | null>(() => {
    const f = toValue(festival)
    if (!f) return null
    const t = now.value.getTime()
    if (t < Date.parse(f.startsAt)) return 'before'
    if (t > Date.parse(f.endsAt)) return 'after'
    return 'during'
  })

  /** Today's festival day, when the festival is running. */
  const today = computed(() => {
    const f = toValue(festival)
    if (!f) return null
    const date = lagosDateKey(now.value)
    return f.days.find((day) => day.date === date) ?? null
  })

  const countdown = computed(() => {
    const f = toValue(festival)
    if (!f) return null
    return splitDuration(Date.parse(f.startsAt) - now.value.getTime())
  })

  return { now, isSimulated, phase, today, countdown }
}

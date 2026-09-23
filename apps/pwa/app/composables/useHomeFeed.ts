import type { EventKind, FestivalEvent } from '@afriff/api'

export interface DontMissCard {
  key: string
  kind: EventKind
  title: string
  when: string
  where: string
  description: string
  price?: string
  access?: string
}

/** Everything the Home screen shows, derived from the programme and the festival clock. */
export function useHomeFeed() {
  const { data: festival } = useFestival()
  const { data: programme, timeline, lookups, pending, error, refresh } = useProgramme()
  const clock = useFestivalClock(festival)
  const { now, phase, today } = clock

  const liveItems = computed(() => timeline.value.filter((item) => isLive(item, now.value)))

  /** Before: opening day. During: what's left today, or tomorrow once today is done. After: nothing. */
  const upNextDay = computed(() => {
    const f = festival.value
    if (!f || phase.value === 'after') return null
    if (phase.value === 'before') return f.days[0] ?? null
    const t = now.value.getTime()
    const todayKey = lagosDateKey(now.value)
    const leftToday = timeline.value.some((item) => lagosDateKey(item.startsAt) === todayKey && Date.parse(item.startsAt) > t)
    if (leftToday) return f.days.find((d) => d.date === todayKey) ?? null
    const index = f.days.findIndex((d) => d.date === todayKey)
    return index >= 0 ? (f.days[index + 1] ?? null) : null
  })

  const upNext = computed(() => {
    const day = upNextDay.value
    if (!day) return []
    const t = now.value.getTime()
    return timeline.value.filter((item) => lagosDateKey(item.startsAt) === day.date && Date.parse(item.startsAt) > t).slice(0, 6)
  })

  const upNextTitle = computed(() => {
    if (phase.value === 'before') return 'Opening day'
    return upNextDay.value?.date === today.value?.date ? 'Up next today' : 'Tomorrow'
  })

  const todayCount = computed(() =>
    today.value ? timeline.value.filter((item) => lagosDateKey(item.startsAt) === today.value?.date).length : 0,
  )

  const featured = computed(() => programme.value?.films.filter((film) => film.featured) ?? [])

  const sections = computed(() =>
    (programme.value?.sections ?? [])
      .map((section) => {
        const films = programme.value?.films.filter((film) => film.sectionId === section.id) ?? []
        return { section, filmCount: films.length, films: films.slice(0, 3) }
      })
      .filter((entry) => entry.filmCount > 0),
  )

  const fromPrice = computed(() => {
    const prices = programme.value?.products.map((p) => p.price.amount) ?? []
    return prices.length ? formatMoney({ amount: Math.min(...prices), currency: 'NGN' }) : undefined
  })

  const venuesToday = computed(() => {
    const counts = new Map<string, number>()
    if (!today.value) return counts
    for (const item of timeline.value) {
      if (lagosDateKey(item.startsAt) === today.value.date) counts.set(item.venue.id, (counts.get(item.venue.id) ?? 0) + 1)
    }
    return counts
  })

  /** Galas, awards, panels and parties, with masterclasses grouped into one card. */
  const dontMiss = computed<DontMissCard[]>(() => {
    const data = programme.value
    const map = lookups.value
    if (!data || !map) return []
    const t = now.value.getTime()
    const upcoming = data.events.filter((e) => Date.parse(e.endsAt) > t)
    const priceOf = (e: FestivalEvent) => {
      const product = e.productId ? map.product.get(e.productId) : undefined
      return product ? formatMoney(product.price) : undefined
    }
    const venueName = (e: FestivalEvent) => map.venue.get(e.venueId)?.name ?? ''

    const cards: DontMissCard[] = []
    for (const e of upcoming) {
      if (e.kind === 'masterclass') continue
      cards.push({
        key: e.id,
        kind: e.kind,
        title: e.title,
        when: `${formatDay(e.startsAt)}, ${formatTime(e.startsAt)}`,
        where: venueName(e),
        description: e.description,
        price: priceOf(e),
        access: e.kind === 'social' ? 'Festival Pass holders' : 'Free for pass holders',
      })
    }
    const masterclasses = upcoming.filter((e) => e.kind === 'masterclass')
    const first = masterclasses[0]
    const last = masterclasses.at(-1)
    if (first && last) {
      cards.push({
        key: 'masterclasses',
        kind: 'masterclass',
        title: `${masterclasses.length} masterclasses`,
        when: `${formatDay(first.startsAt)} to ${formatDay(last.startsAt)}, ${formatTime(first.startsAt)} daily`,
        where: venueName(first),
        description: masterclasses.map((e) => e.title).join(', '),
        price: priceOf(first),
      })
    }
    return cards.sort((a, b) => (a.kind === 'gala' ? -1 : b.kind === 'gala' ? 1 : 0))
  })

  return {
    festival,
    programme,
    lookups,
    pending,
    error,
    refresh,
    ...clock,
    liveItems,
    upNextDay,
    upNext,
    upNextTitle,
    todayCount,
    featured,
    sections,
    fromPrice,
    venuesToday,
    dontMiss,
  }
}

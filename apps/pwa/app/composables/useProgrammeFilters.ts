import type { LocationQueryRaw } from 'vue-router'
import type { Genre } from '@afriff/api'
import type { ProgrammeFilterState, ProgrammeView, TimeOfDay } from '@afriff/api/filters'

/** Filter group → query-string key. Lists are comma-separated: `?venue=landmark-centre,terra-kulture`. */
const QUERY_KEYS = {
  sections: 'section',
  venues: 'venue',
  genres: 'genre',
  times: 'time',
  languages: 'lang',
} as const

export type FilterGroup = keyof typeof QUERY_KEYS

/**
 * Programme filters kept in the URL, so views are shareable, survive reloads and
 * work with the back button. Every change uses `router.replace` (no history spam).
 */
export function useProgrammeFilters() {
  const route = useRoute()
  const router = useRouter()

  function readList(key: string): string[] {
    const raw = route.query[key]
    const value = Array.isArray(raw) ? raw.join(',') : (raw ?? '')
    return value ? value.split(',').filter(Boolean) : []
  }

  const filters = computed<ProgrammeFilterState>(() => ({
    sections: readList(QUERY_KEYS.sections),
    venues: readList(QUERY_KEYS.venues),
    genres: readList(QUERY_KEYS.genres) as Genre[],
    times: readList(QUERY_KEYS.times) as TimeOfDay[],
    languages: readList(QUERY_KEYS.languages),
    q: typeof route.query.q === 'string' ? route.query.q : '',
  }))

  const view = computed<ProgrammeView>(() => (route.query.view === 'films' ? 'films' : 'schedule'))
  const day = computed(() => (typeof route.query.day === 'string' ? route.query.day : null))
  const activeCount = computed(() => activeFilterCount(filters.value))

  function update(patch: Record<string, string | string[] | null | undefined>) {
    const query: LocationQueryRaw = { ...route.query }
    for (const [key, value] of Object.entries(patch)) {
      const text = Array.isArray(value) ? value.join(',') : value
      if (text) query[key] = text
      else delete query[key]
    }
    return router.replace({ query })
  }

  function has(group: FilterGroup, value: string) {
    return (filters.value[group] as string[]).includes(value)
  }

  function toggle(group: FilterGroup, value: string) {
    const current = filters.value[group] as string[]
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value]
    return update({ [QUERY_KEYS[group]]: next })
  }

  function clearGroup(group: FilterGroup) {
    return update({ [QUERY_KEYS[group]]: null })
  }

  function clearAll() {
    return update({ section: null, venue: null, genre: null, time: null, lang: null, q: null })
  }

  return {
    filters,
    view,
    day,
    activeCount,
    has,
    toggle,
    clearGroup,
    clearAll,
    setView: (value: ProgrammeView) => update({ view: value === 'films' ? 'films' : null }),
    setDay: (value: string | null) => update({ day: value }),
    setQuery: (value: string) => update({ q: value.trim() || null }),
  }
}

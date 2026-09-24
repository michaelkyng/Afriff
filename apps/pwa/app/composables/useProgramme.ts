import type { ProgrammeData } from '@afriff/api/programme'

/**
 * Everything the programme screens need, fetched once and shared under one key:
 * films, venues, sections, screenings, events and ticket products — plus lookups
 * and a merged, time-sorted timeline of screenings and events.
 */
export function useProgramme() {
  const api = useApi()

  const result = useLazyAsyncData(
    'programme:all',
    async (): Promise<ProgrammeData> => {
      const [films, venues, sections, screenings, events, products] = await Promise.all([
        api.programme.listFilms(),
        api.programme.listVenues(),
        api.programme.listSections(),
        api.programme.listScreenings(),
        api.programme.listEvents(),
        api.catalog.listProducts(),
      ])
      return { films, venues, sections, screenings, events, products }
    },
    { getCachedData: reuseLoaded },
  )

  const lookups = computed(() => (result.data.value ? buildLookups(result.data.value) : null))
  const timeline = computed(() =>
    result.data.value && lookups.value ? buildTimeline(result.data.value, lookups.value) : [],
  )

  return {
    data: result.data,
    status: result.status,
    error: result.error,
    refresh: result.refresh,
    pending: computed(() => result.status.value === 'pending' && !result.data.value),
    lookups,
    timeline,
  }
}

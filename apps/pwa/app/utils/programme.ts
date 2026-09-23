import type { ProgrammeItem } from '@afriff/api/programme'

// Expose shared domain helpers to Nuxt auto-imports.
export { availabilityOf, buildLookups, buildTimeline, hasEnded, isLive, progressOf, formatStartsIn } from '@afriff/api/programme'

/** Where a timeline card links: screenings open the film page; ticketed events go to passes. */
export function programmeItemLink(item: ProgrammeItem): string | undefined {
  if (item.kind === 'screening') return `/programme/${item.film.slug}`
  return item.product ? '/tickets' : undefined
}


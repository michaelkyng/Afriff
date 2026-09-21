import type { Film, Screening } from '../../types'
import { festival } from './festival'
import { films } from './films'
import { venues } from './venues'

/**
 * MOCK DATA — screenings are generated deterministically from the film list,
 * so the schedule is identical on every device and every reload.
 */

const TIMES = ['11:00', '13:30', '16:00', '18:30', '21:00'] as const

/** Screens that carry the regular programme (Eko Hotel is reserved for galas). */
const ROTATION = ['scr_lm_1', 'scr_lm_2', 'scr_lm_3', 'scr_tw_a', 'scr_tw_b', 'scr_tk_theatre'] as const
type RotationScreen = (typeof ROTATION)[number]

const PREFERRED: Record<string, RotationScreen[]> = {
  sec_feature: ['scr_lm_1', 'scr_tw_a', 'scr_lm_2'],
  sec_nollywood: ['scr_lm_1', 'scr_tw_a', 'scr_lm_2'],
  sec_documentary: ['scr_tw_b', 'scr_lm_3', 'scr_lm_2'],
  sec_shorts: ['scr_tk_theatre', 'scr_lm_3'],
  sec_animation: ['scr_tk_theatre', 'scr_lm_3'],
  sec_student: ['scr_tk_theatre', 'scr_lm_3'],
  sec_special: ['scr_lm_1'],
}

const SCREENINGS_PER_FILM: Record<string, number> = {
  sec_feature: 3,
  sec_nollywood: 3,
  sec_documentary: 2,
  sec_shorts: 2,
  sec_animation: 2,
  sec_student: 2,
  sec_special: 1,
}

const screenIndex = new Map(
  venues.flatMap((venue) => venue.screens.map((screen) => [screen.id, { venue, screen }] as const)),
)

/** Slots that are not available for regular screenings. */
function isBlocked(dayIndex: number, timeIndex: number, screenId: RotationScreen): boolean {
  const lastDay = festival.days.length - 1
  if (dayIndex === 0 && timeIndex < 2) return true // opening day starts at 16:00
  if (dayIndex === lastDay && timeIndex > 2) return true // closing night is the Globe Awards
  if (screenId === 'scr_tk_theatre' && dayIndex >= 1 && dayIndex <= 4 && timeIndex === 0) return true // masterclasses
  return false
}

/** Small deterministic PRNG (mulberry32) so "sold" numbers are stable. */
function prng(seed: number) {
  let t = seed >>> 0
  return () => {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

/** Lagos is UTC+1 all year (no DST), so we can format offsets directly. */
function toLagosIso(ms: number): string {
  return new Date(ms + 60 * 60 * 1000).toISOString().replace(/\.\d{3}Z$/, '+01:00')
}

function generate(): Screening[] {
  const taken = new Set<string>()
  const random = prng(2026)
  const result: Screening[] = []

  // Opening Night gala screening (entry via the Opening Night Gala ticket).
  const openingFilm = films.find((f) => f.id === 'flm_harmattan')!
  const galaStart = '2026-11-01T19:30:00+01:00'
  result.push({
    id: 'scn_gala_opening',
    filmId: openingFilm.id,
    venueId: 'ven_eko',
    screenId: 'scr_eko_hall',
    startsAt: galaStart,
    endsAt: toLagosIso(Date.parse(galaStart) + (openingFilm.runtimeMin + 30) * 60_000),
    format: 'Gala',
    hasQa: true,
    capacity: 900,
    sold: 612,
  })

  films.forEach((film: Film, filmIndex) => {
    const count = SCREENINGS_PER_FILM[film.sectionId] ?? 2
    const preferred = PREFERRED[film.sectionId] ?? [...ROTATION]

    for (let k = 0; k < count; k++) {
      let placed = false
      // Spread repeats across the week, then walk forward until a free slot is found.
      for (let attempt = 0; attempt < 7 * TIMES.length * preferred.length && !placed; attempt++) {
        const dayIndex = (filmIndex + k * 3 + Math.floor(attempt / (TIMES.length * preferred.length))) % festival.days.length
        const timeIndex = (filmIndex + k * 2 + attempt) % TIMES.length
        const screenId = preferred[(filmIndex + k + Math.floor(attempt / TIMES.length)) % preferred.length]!
        const key = `${dayIndex}|${timeIndex}|${screenId}`
        if (taken.has(key) || isBlocked(dayIndex, timeIndex, screenId)) continue

        taken.add(key)
        placed = true

        const day = festival.days[dayIndex]!
        const startsAt = `${day.date}T${TIMES[timeIndex]}:00+01:00`
        const hasQa = k === 0 && Boolean(film.premiere)
        const { venue, screen } = screenIndex.get(screenId)!
        const soldOut = (film.id === 'flm_harmattan' && k === 0) || random() > 0.92
        const sold = soldOut ? screen.capacity : Math.round(screen.capacity * (0.15 + random() * 0.8))

        result.push({
          id: `scn_${film.slug}_${k + 1}`,
          filmId: film.id,
          venueId: venue.id,
          screenId: screen.id,
          startsAt,
          endsAt: toLagosIso(Date.parse(startsAt) + (film.runtimeMin + (hasQa ? 30 : 0)) * 60_000),
          format: 'Standard',
          hasQa,
          capacity: screen.capacity,
          sold,
        })
      }
    }
  })

  return result.sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.screenId.localeCompare(b.screenId))
}

export const screenings: Screening[] = generate()

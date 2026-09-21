import type { Money } from './types'

/** All festival times are shown in Lagos time, whatever the device timezone. */
export const FESTIVAL_TZ = 'Africa/Lagos'
const LOCALE = 'en-NG'

const moneyFormatter = new Intl.NumberFormat(LOCALE, {
  style: 'currency',
  currency: 'NGN',
  currencyDisplay: 'narrowSymbol',
  maximumFractionDigits: 0,
})

/** ₦75,000 — amounts are stored in kobo. */
export function formatMoney(money: Money): string {
  return moneyFormatter.format(money.amount / 100)
}

const timeFormatter = new Intl.DateTimeFormat(LOCALE, {
  timeZone: FESTIVAL_TZ,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

/** 18:30 */
export function formatTime(value: string | Date): string {
  return timeFormatter.format(new Date(value))
}

const dayFormatter = new Intl.DateTimeFormat(LOCALE, {
  timeZone: FESTIVAL_TZ,
  weekday: 'short',
  day: 'numeric',
  month: 'short',
})

/** Tue 3 Nov */
export function formatDay(value: string | Date): string {
  return dayFormatter.format(new Date(value)).replace(',', '')
}

const longDateFormatter = new Intl.DateTimeFormat(LOCALE, {
  timeZone: FESTIVAL_TZ,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

/** Tuesday 3 November 2026 */
export function formatLongDate(value: string | Date): string {
  return longDateFormatter.format(new Date(value)).replace(',', '')
}

const dayMonth = new Intl.DateTimeFormat(LOCALE, { timeZone: FESTIVAL_TZ, day: 'numeric', month: 'short' })
const dayOnly = new Intl.DateTimeFormat(LOCALE, { timeZone: FESTIVAL_TZ, day: 'numeric' })
const monthYear = new Intl.DateTimeFormat(LOCALE, { timeZone: FESTIVAL_TZ, month: 'long', year: 'numeric' })

/** 1–7 November 2026 (or 30 Oct – 2 Nov 2026 across months) */
export function formatDateRange(start: string | Date, end: string | Date): string {
  const a = new Date(start)
  const b = new Date(end)
  if (monthYear.format(a) === monthYear.format(b)) {
    return `${dayOnly.format(a)}–${dayOnly.format(b)} ${monthYear.format(b)}`
  }
  return `${dayMonth.format(a)} – ${dayMonth.format(b)} ${b.getFullYear()}`
}

/** 1h 52m */
export function formatRuntime(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (!h) return `${m}m`
  return m ? `${h}h ${m}m` : `${h}h`
}

const dateKeyFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: FESTIVAL_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** The Lagos calendar date for an instant, as YYYY-MM-DD. */
export function lagosDateKey(value: string | Date): string {
  return dateKeyFormatter.format(new Date(value))
}

export interface DurationParts {
  totalMs: number
  days: number
  hours: number
  minutes: number
  seconds: number
}

/** Splits a duration into days/hours/minutes/seconds (negative durations clamp to zero). */
export function splitDuration(ms: number): DurationParts {
  const totalMs = Math.max(0, ms)
  const totalSeconds = Math.floor(totalMs / 1000)
  return {
    totalMs,
    days: Math.floor(totalSeconds / 86_400),
    hours: Math.floor((totalSeconds % 86_400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  }
}

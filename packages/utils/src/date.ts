import { format, formatDistanceToNow, startOfDay, subDays } from 'date-fns'

/**
 * The three formatters below share one shape: omit the locale and the output is today's date-fns
 * output, character for character; pass one and the value is formatted the way that locale writes
 * it.
 *
 * The default is a contract rather than a fallback. The admin renders every date through these
 * functions and none of its screens may move by a character, so the no-locale path stays the
 * expression it already was instead of being re-derived through something that agrees with it
 * "closely enough" — `Intl` puts a comma in the datetime and drops the "about" from the relative
 * time, and neither difference is one this slice is allowed to spend.
 *
 * `Intl` is what the locale path uses because it takes the BCP 47 tag the storefront already holds.
 * date-fns localises through imported `Locale` objects, which would mean a hand-maintained
 * tag-to-object map — a second locale vocabulary running beside the one the URL already carries.
 */

export function todayIso() {
  return startOfDay(new Date()).toISOString()
}

export function daysAgoIso(days: number) {
  return startOfDay(subDays(new Date(), days)).toISOString()
}

export function formatDate(date: string | number | Date, locale?: string) {
  if (!locale) return format(new Date(date), 'MMM d, yyyy')
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(date))
}

export function formatDatetime(date: string | number | Date, locale?: string) {
  if (!locale) return format(new Date(date), 'MMM d, yyyy h:mm a')
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(date))
}

/**
 * The units a relative time is rounded to, largest first, with how many seconds one of them is.
 * A month is the average Gregorian month and a year the average Gregorian year: the output is
 * "3 months ago", so a definition accurate to the day would be precision nobody reads.
 */
const RELATIVE_UNITS: { unit: Intl.RelativeTimeFormatUnit; seconds: number }[] = [
  { unit: 'year', seconds: 365.2425 * 24 * 60 * 60 },
  { unit: 'month', seconds: 30.436875 * 24 * 60 * 60 },
  { unit: 'day', seconds: 24 * 60 * 60 },
  { unit: 'hour', seconds: 60 * 60 },
  { unit: 'minute', seconds: 60 },
  { unit: 'second', seconds: 1 },
]

export function formatRelativeTime(date: string | number | Date, locale?: string) {
  if (!locale) return formatDistanceToNow(new Date(date), { addSuffix: true })

  const elapsedSeconds = (new Date(date).getTime() - Date.now()) / 1000
  // The last entry is the fallback rather than a special case: a difference under a second is
  // "now" in every locale, which is what `numeric: 'auto'` renders zero seconds as.
  const rounded = RELATIVE_UNITS.find((candidate) => Math.abs(elapsedSeconds) >= candidate.seconds)
  const { unit, seconds } = rounded ?? { unit: 'second' as const, seconds: 1 }

  return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(Math.round(elapsedSeconds / seconds), unit)
}

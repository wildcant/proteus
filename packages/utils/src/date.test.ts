import { format, formatDistanceToNow } from 'date-fns'
import { describe, expect, it } from 'vitest'
import { formatDate, formatDatetime, formatRelativeTime } from './date.ts'

/** Fixed and unambiguous: a single-digit day and a morning time, where locales disagree the most. */
const MOMENT = new Date(2026, 0, 5, 10, 45)

/**
 * Every "no locale" case asserts against the date-fns expression the function used before this
 * slice, not against a copy of its output. That is the point of the check: the admin passes no
 * locale, so the day these two disagree is the day eleven admin screens change without anyone
 * asking them to.
 */
describe('formatDate', () => {
  it('reproduces the date-fns output exactly when no locale is given', () => {
    expect(formatDate(MOMENT)).toBe(format(MOMENT, 'MMM d, yyyy'))
    expect(formatDate(MOMENT)).toBe('Jan 5, 2026')
  })

  it('writes the date the way the given market writes it', () => {
    expect(formatDate(MOMENT, 'es-CO')).toBe('5/01/2026')
  })

  it('accepts the ISO strings the API returns', () => {
    expect(formatDate(MOMENT.toISOString())).toBe('Jan 5, 2026')
  })
})

describe('formatDatetime', () => {
  it('reproduces the date-fns output exactly when no locale is given', () => {
    expect(formatDatetime(MOMENT)).toBe(format(MOMENT, 'MMM d, yyyy h:mm a'))
    expect(formatDatetime(MOMENT)).toBe('Jan 5, 2026 10:45 AM')
  })

  it('writes the datetime the way the given market writes it', () => {
    // Day-first, and a Spanish meridiem. The American form is the same date and time read the
    // other way round, which is exactly the confusion this parameter exists to remove.
    expect(formatDatetime(MOMENT, 'es-CO')).toBe('5/01/2026, 10:45 a. m.')
  })
})

describe('formatRelativeTime', () => {
  it('reproduces the date-fns output exactly when no locale is given', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000)
    expect(formatRelativeTime(twoHoursAgo)).toBe(formatDistanceToNow(twoHoursAgo, { addSuffix: true }))
    expect(formatRelativeTime(twoHoursAgo)).toBe('about 2 hours ago')
  })

  it('speaks the given market’s language, and rounds to the largest unit that fits', () => {
    expect(formatRelativeTime(new Date(Date.now() - 2 * 60 * 60 * 1000), 'es-CO')).toBe('hace 2 horas')
    expect(formatRelativeTime(new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), 'es-CO')).toBe('hace 3 días')
    expect(formatRelativeTime(new Date(Date.now() - 2 * 60 * 60 * 1000), 'en-US')).toBe('2 hours ago')
  })

  it('names the day rather than counting hours to it', () => {
    // What `numeric: 'auto'` buys: a shopper reads "yesterday", not "1 day ago".
    expect(formatRelativeTime(new Date(Date.now() - 25 * 60 * 60 * 1000), 'en-US')).toBe('yesterday')
  })

  it('has an answer for a difference smaller than its smallest unit', () => {
    expect(formatRelativeTime(new Date(), 'en-US')).toBe('now')
  })

  it('reads a future moment as ahead rather than behind', () => {
    expect(formatRelativeTime(new Date(Date.now() + 3 * 60 * 60 * 1000), 'en-US')).toBe('in 3 hours')
  })
})

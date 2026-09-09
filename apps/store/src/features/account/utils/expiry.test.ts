import { describe, expect, test } from 'vitest'
import { expiryStatus, formatExpiry, isUsable } from './expiry'

/**
 * The month boundary, stated rather than clicked through.
 *
 * `expiryStatus` is the one predicate the row, the selector and the auto-selection all share, and
 * the whole of it is one comparison. Proving it through a rendered wallet would need a fixture per
 * case and a way to move the clock; here the clock is an argument.
 *
 * `now` is passed explicitly everywhere below — a test that reads the real one is a test that
 * changes its answer on the 1st of the month.
 */

/** Noon on the 15th, so nothing here depends on a timezone rolling the date over. */
const june2027 = new Date(2027, 5, 15, 12)

describe('expiryStatus', () => {
  test.each([
    { label: 'a card expiring years out', expMonth: 12, expYear: 2030, status: 'ok' },
    { label: 'a card expiring later this year', expMonth: 12, expYear: 2027, status: 'ok' },
    { label: 'a card expiring next month', expMonth: 7, expYear: 2027, status: 'ok' },
    { label: 'a card expiring this month', expMonth: 6, expYear: 2027, status: 'expiring' },
    { label: 'a card that expired last month', expMonth: 5, expYear: 2027, status: 'expired' },
    { label: 'a card that expired last year', expMonth: 12, expYear: 2026, status: 'expired' },
  ] as const)('$label is $status', ({ expMonth, expYear, status }) => {
    expect(expiryStatus({ expMonth, expYear }, june2027)).toBe(status)
  })

  test('compares absolute months, not year then month', () => {
    // The case a year-then-month comparison gets wrong: December is the later *month* but 2026 is
    // the earlier year, and a card that expired six months ago must not read as good for another six.
    expect(expiryStatus({ expMonth: 12, expYear: 2026 }, new Date(2027, 0, 15, 12))).toBe('expired')
    expect(expiryStatus({ expMonth: 1, expYear: 2027 }, new Date(2027, 0, 15, 12))).toBe('expiring')
  })

  test('a card is good until the last day of the month it expires in', () => {
    // Both ends of the month the card expires in — the warning is a warning for the whole of it.
    expect(expiryStatus({ expMonth: 6, expYear: 2027 }, new Date(2027, 5, 1, 0, 0))).toBe('expiring')
    expect(expiryStatus({ expMonth: 6, expYear: 2027 }, new Date(2027, 5, 30, 23, 59))).toBe('expiring')
    expect(expiryStatus({ expMonth: 6, expYear: 2027 }, new Date(2027, 6, 1, 0, 0))).toBe('expired')
  })
})

describe('isUsable', () => {
  test('the expiring month is still usable, and only the expired month is not', () => {
    // The distinction the selector rests on: `expiring` is labelled but selectable, because
    // refusing it would turn a warning into a wrongly declined checkout.
    expect(isUsable({ expMonth: 6, expYear: 2027 }, june2027)).toBe(true)
    expect(isUsable({ expMonth: 7, expYear: 2027 }, june2027)).toBe(true)
    expect(isUsable({ expMonth: 5, expYear: 2027 }, june2027)).toBe(false)
  })
})

describe('formatExpiry', () => {
  test('prints the month padded and the year in two digits, as the card does', () => {
    expect(formatExpiry({ expMonth: 3, expYear: 2027 })).toBe('03/27')
    expect(formatExpiry({ expMonth: 12, expYear: 2030 })).toBe('12/30')
    // The year 2100 problem this does not have: `slice(-2)` is the card's own convention.
    expect(formatExpiry({ expMonth: 1, expYear: 2100 })).toBe('01/00')
  })
})

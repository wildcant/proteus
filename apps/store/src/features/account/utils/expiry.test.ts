import { describe, expect, test } from 'vitest'
import { expiryStatus, formatExpiry, isUsable } from './expiry'

/**
 * The whole of this function is one boundary, and every interesting case is a day either side of
 * it. Exercising them through a rendered card list would need twelve fixtures and a clock.
 */

/** Mid-March 2026. Months are zero-based in `Date`, which is the trap these tests exist around. */
const march2026 = new Date(2026, 2, 15)

describe('expiryStatus', () => {
  test('a card whose month has not arrived is fine', () => {
    expect(expiryStatus({ expMonth: 4, expYear: 2026 }, march2026)).toBe('ok')
    expect(expiryStatus({ expMonth: 1, expYear: 2030 }, march2026)).toBe('ok')
  })

  test('the current month is expiring, not expired — the card still works all month', () => {
    expect(expiryStatus({ expMonth: 3, expYear: 2026 }, march2026)).toBe('expiring')
    expect(isUsable({ expMonth: 3, expYear: 2026 }, march2026)).toBe(true)
  })

  test('last month is expired', () => {
    expect(expiryStatus({ expMonth: 2, expYear: 2026 }, march2026)).toBe('expired')
    expect(isUsable({ expMonth: 2, expYear: 2026 }, march2026)).toBe(false)
  })

  test('a later month in an earlier year is expired, which year-then-month comparison gets wrong', () => {
    // 12/2025 is *after* 03 as a month and *before* March 2026 as a date. Comparing the month
    // first, or at all separately, calls this card good for another nine months.
    expect(expiryStatus({ expMonth: 12, expYear: 2025 }, march2026)).toBe('expired')
  })

  test('an earlier month in a later year is fine, the same trap from the other side', () => {
    expect(expiryStatus({ expMonth: 1, expYear: 2027 }, march2026)).toBe('ok')
  })

  test('January and December are read as the boundaries they are', () => {
    const january = new Date(2026, 0, 1)
    expect(expiryStatus({ expMonth: 12, expYear: 2025 }, january)).toBe('expired')
    expect(expiryStatus({ expMonth: 1, expYear: 2026 }, january)).toBe('expiring')

    const december = new Date(2026, 11, 31)
    expect(expiryStatus({ expMonth: 12, expYear: 2026 }, december)).toBe('expiring')
    expect(expiryStatus({ expMonth: 1, expYear: 2027 }, december)).toBe('ok')
  })
})

describe('formatExpiry', () => {
  test('pads the month and prints the last two digits of the year, as the card does', () => {
    expect(formatExpiry({ expMonth: 3, expYear: 2027 })).toBe('03/27')
    expect(formatExpiry({ expMonth: 12, expYear: 2030 })).toBe('12/30')
  })
})

import { BigNumber } from '@core/db/bignum.js'
import { test } from '@tests/setup/test-extend.js'
import { fromSmallestUnit, toSmallestUnit } from '../currency-units.js'

test.describe('toSmallestUnit', () => {
  test('scales a two-decimal currency by its own exponent', ({ expect }) => {
    // The two failures the adapter shipped with: 19.99 was rejected as non-integer, and 20 was
    // charged as twenty cents.
    expect(toSmallestUnit(new BigNumber('19.99'), 'usd')).toBe(1999)
    expect(toSmallestUnit(new BigNumber('20'), 'usd')).toBe(2000)
    expect(toSmallestUnit(new BigNumber('0.01'), 'eur')).toBe(1)
  })

  test('leaves a zero-decimal currency alone', ({ expect }) => {
    expect(toSmallestUnit(new BigNumber('1000'), 'jpy')).toBe(1000)
    expect(toSmallestUnit(new BigNumber('35000'), 'krw')).toBe(35000)
  })

  test('rounds a three-decimal currency up to a multiple of ten', ({ expect }) => {
    // Stripe rejects three-decimal amounts that are not a multiple of ten, and rounding up
    // means the charge is never a fraction short of what the shopper agreed to.
    expect(toSmallestUnit(new BigNumber('19.99'), 'bhd')).toBe(19990)
    expect(toSmallestUnit(new BigNumber('1.234'), 'kwd')).toBe(1240)
    expect(toSmallestUnit(new BigNumber('1.231'), 'omr')).toBe(1240)
  })

  test('is case-insensitive about the currency code', ({ expect }) => {
    expect(toSmallestUnit(new BigNumber('1000'), 'JPY')).toBe(1000)
    expect(toSmallestUnit(new BigNumber('19.99'), 'USD')).toBe(1999)
  })

  test('treats an unknown currency as two-decimal', ({ expect }) => {
    expect(toSmallestUnit(new BigNumber('19.99'), 'zzz')).toBe(1999)
  })

  test('produces an integer even when float arithmetic upstream did not', ({ expect }) => {
    // Cart totals are summed from doubles before they reach a BigNumber, so 9.99 + 10 arrives
    // as 19.990000000000002. Stripe rejects anything that is not an integer.
    expect(toSmallestUnit(new BigNumber(9.99 + 10), 'usd')).toBe(1999)
  })
})

test.describe('fromSmallestUnit', () => {
  test('inverts the conversion for each exponent', ({ expect }) => {
    expect(fromSmallestUnit(1999, 'usd').toFixed()).toBe('19.99')
    expect(fromSmallestUnit(1000, 'jpy').toFixed()).toBe('1000')
    expect(fromSmallestUnit(19990, 'bhd').toFixed()).toBe('19.99')
  })

  test('round-trips a major-unit amount unchanged', ({ expect }) => {
    for (const [amount, currency] of [
      ['19.99', 'usd'],
      ['1000', 'jpy'],
      ['1.24', 'kwd'],
    ] as const) {
      const roundTripped = fromSmallestUnit(toSmallestUnit(new BigNumber(amount), currency), currency)
      expect(roundTripped.toFixed(), currency).toBe(new BigNumber(amount).toFixed())
    }
  })
})

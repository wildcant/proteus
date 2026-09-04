import { describe, expect, it } from 'vitest'
import { formatAmount, formatPrice, getCurrencySymbol } from './pricing.ts'

/**
 * Two claims, and the first is the one that protects the admin: omitting the locale has to keep
 * producing American output, because the admin's call sites are not being edited and must not move.
 * The second is what the storefront buys by passing one — a Colombian shopper reading pesos as
 * pesos rather than as the three letters `COP`.
 */
describe('formatPrice', () => {
  it('formats American when no locale is given', () => {
    expect(formatPrice('1234.5', 'usd')).toBe('$1,234.50')
  })

  it('formats American when the American locale is given, so the default is not a special case', () => {
    expect(formatPrice('1234.5', 'usd', 'en-US')).toBe(formatPrice('1234.5', 'usd'))
  })

  it('writes pesos as pesos for a Colombian market', () => {
    // The symbol and the Colombian separators, and no `COP` anywhere: `en-US` renders this same
    // amount as `COP 100,000`, which is the bare currency code criterion 4 rules out.
    const formatted = formatPrice('100000', 'cop', 'es-CO')
    expect(formatted).toContain('$')
    expect(formatted).toContain('100.000')
    expect(formatted).not.toContain('COP')
  })

  it('keeps a market that is not the currency honest about whose dollars these are', () => {
    // A Colombian reading a US-dollar price gets `US$`, not `$` — the distinction the peso symbol
    // above would otherwise erase. The gap is the non-breaking space Intl puts there, spelled out
    // rather than typed, because the two are indistinguishable in a diff.
    expect(formatPrice('25', 'usd', 'es-CO')).toBe('US$\u00a025,00')
  })
})

describe('getCurrencySymbol', () => {
  it('resolves the narrow symbol American-style when no locale is given', () => {
    expect(getCurrencySymbol('usd')).toBe('$')
    expect(getCurrencySymbol('eur')).toBe('€')
  })

  it('resolves the symbol the given locale writes', () => {
    expect(getCurrencySymbol('cop', 'es-CO')).toBe('$')
  })
})

describe('formatAmount', () => {
  it('keeps the currency’s decimal places without the symbol when no locale is given', () => {
    expect(formatAmount('1234.5', 'usd')).toBe('1,234.50')
  })

  it('uses the given locale’s separators and the currency’s decimal places', () => {
    // COP carries no minor unit, so the Colombian amount is written whole — and grouped with dots.
    expect(formatAmount('100000', 'cop', 'es-CO')).toBe('100.000')
  })

  it('returns the input untouched when it is not a number', () => {
    expect(formatAmount('not a price', 'usd')).toBe('not a price')
  })
})

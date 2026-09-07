import { describe, expect, it } from 'vitest'
import { formatAmount, formatPrice, getCurrencyName, getCurrencySymbol } from './pricing.ts'

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

describe('getCurrencyName', () => {
  it('names the currency in words, which is what a bare code does not', () => {
    expect(getCurrencyName('eur')).toBe('Euro')
    expect(getCurrencyName('usd')).toBe('US Dollar')
    expect(getCurrencyName('cop')).toBe('Colombian Peso')
  })

  it('takes the code in either case, since prices carry the lowercase form', () => {
    expect(getCurrencyName('COP')).toBe(getCurrencyName('cop'))
  })

  it('names it in the given locale', () => {
    expect(getCurrencyName('cop', 'es-CO')).not.toBe(getCurrencyName('cop', 'en-US'))
  })

  it('falls back to the uppercased code when the runtime knows no name for it', () => {
    // Not a real ISO 4217 code. A label is still wanted — the region editor has a row to fill.
    expect(getCurrencyName('zzz')).toBe('ZZZ')
  })

  it('answers a malformed code with a label instead of taking the table down', () => {
    // `Intl.DisplayNames` separates these two cases where a caller cannot: `ZZZ` above comes back
    // as itself, but anything that is not three letters is a `RangeError`. This runs once per row
    // of the Currencies table, so an unhandled one is a blank screen rather than a blank cell.
    expect(getCurrencyName('us')).toBe('US')
    expect(getCurrencyName('')).toBe('')
    expect(getCurrencyName('12345')).toBe('12345')
  })

  it('answers a malformed locale the same way, since the locale is the other argument Intl refuses', () => {
    expect(getCurrencyName('usd', 'en_US')).toBe('USD')
  })
})

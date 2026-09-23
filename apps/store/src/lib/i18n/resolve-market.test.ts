import { describe, expect, test } from 'vitest'
import { DEFAULT_MARKET, type Market, type SellableMarkets } from '#/lib/market'
import { catalogLanguageFor, requestLocaleCodeFor, resolveMarket } from './resolve-market'

/**
 * The market and catalog a router is built for, read before the router exists. Stated here because
 * the same answer has to come out of the server's request URL and the client's `window.location`,
 * and a disagreement between the two is a hydration mismatch on every translated text node.
 */

const colombia: Market = { localeCode: 'es-CO', iso2: 'co', displayName: 'Colombia', currencyCode: 'cop' }
const france: Market = { localeCode: 'fr-FR', iso2: 'fr', displayName: 'France', currencyCode: 'eur' }
const sellable: SellableMarkets = { markets: [DEFAULT_MARKET, colombia, france], defaultMarket: DEFAULT_MARKET }

describe('resolveMarket', () => {
  test('the market segment in the URL names the market', () => {
    expect(resolveMarket('/es-CO/products/shirt', sellable)).toBe(colombia)
  })

  test('a URL with no market segment stands at the default market', () => {
    expect(resolveMarket('/products', sellable)).toBe(DEFAULT_MARKET)
  })

  test('a segment shaped like a market the store does not sell in stands at the default market', () => {
    expect(resolveMarket('/de-DE/products', sellable)).toBe(DEFAULT_MARKET)
  })

  test('the default is the one the backend named, not the compiled-in one', () => {
    expect(resolveMarket('/', { ...sellable, defaultMarket: colombia })).toBe(colombia)
  })
})

describe('catalogLanguageFor', () => {
  test('the language subtag of the market names the catalog', () => {
    expect(catalogLanguageFor(colombia, DEFAULT_MARKET)).toBe('es')
    expect(catalogLanguageFor(DEFAULT_MARKET, colombia)).toBe('en')
  })

  test('a language with no catalog falls back to the default market language', () => {
    expect(catalogLanguageFor(france, colombia)).toBe('es')
  })

  test('when the default market language has no catalog either, the source language renders', () => {
    expect(catalogLanguageFor(france, france)).toBe('en')
  })
})

describe('requestLocaleCodeFor', () => {
  test('a URL in a market sends that market locale code', () => {
    expect(requestLocaleCodeFor('/es-CO/cart')).toBe('es-CO')
  })

  test('a URL with no market segment sends the compiled-in default', () => {
    expect(requestLocaleCodeFor('/')).toBe(DEFAULT_MARKET.localeCode)
    expect(requestLocaleCodeFor('/_serverFn/abc')).toBe(DEFAULT_MARKET.localeCode)
  })
})

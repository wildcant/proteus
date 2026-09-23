import { describe, expect, test } from 'vitest'
import { DEFAULT_MARKET, type Market, readShopperCountry, resolveMarketTarget } from './market'

/**
 * Where a request with no market in its URL is sent, stated rather than driven through a browser.
 *
 * The country is Cloudflare's edge geo-IP, and that lookup does not exist off the edge: a local
 * server has no `cf` and no `CF-IPCountry`. The resolver takes the country as an argument, so every
 * case the edge could produce is one row here instead of a spoofable override in the Worker.
 */

const colombia: Market = { localeCode: 'es-CO', iso2: 'co', displayName: 'Colombia', currencyCode: 'cop' }
const markets: ReadonlyArray<Market> = [DEFAULT_MARKET, colombia]

describe('resolveMarketTarget', () => {
  test('a first visit from a country the store sells in lands on that market', () => {
    expect(resolveMarketTarget({ cookie: undefined, country: 'CO', markets })).toBe('es-CO')
  })

  test.each([
    { label: 'unknown (XX)', country: 'XX' },
    { label: 'Tor (T1)', country: 'T1' },
    { label: 'a country the store does not sell in', country: 'FR' },
    { label: 'no country at all', country: undefined },
    { label: 'an empty country', country: '' },
  ])('a first visit from $label lands on the default market', ({ country }) => {
    expect(resolveMarketTarget({ cookie: undefined, country, markets })).toBe(DEFAULT_MARKET.localeCode)
  })

  test('matches the country whatever its case', () => {
    expect(resolveMarketTarget({ cookie: undefined, country: 'co', markets })).toBe('es-CO')
  })

  test('a remembered market wins over the country the shopper is in', () => {
    expect(resolveMarketTarget({ cookie: 'en-US', country: 'CO', markets })).toBe('en-US')
  })

  test('a remembered market the store no longer sells in gives way to the country', () => {
    expect(resolveMarketTarget({ cookie: 'fr-FR', country: 'CO', markets })).toBe('es-CO')
  })

  test('a stale cookie and no usable country lands on the default market', () => {
    expect(resolveMarketTarget({ cookie: 'fr-FR', country: 'XX', markets })).toBe(DEFAULT_MARKET.localeCode)
  })
})

describe('readShopperCountry', () => {
  test('reads the country Cloudflare attached to the request', () => {
    const request = Object.assign(new Request('https://store.test/'), { cf: { country: 'CO' } })
    expect(readShopperCountry(request)).toBe('CO')
  })

  test('prefers `cf` over the header when both are present', () => {
    const request = Object.assign(new Request('https://store.test/', { headers: { 'cf-ipcountry': 'US' } }), {
      cf: { country: 'CO' },
    })
    expect(readShopperCountry(request)).toBe('CO')
  })

  test('falls back to `CF-IPCountry` when `cf` did not reach the request', () => {
    const request = new Request('https://store.test/', { headers: { 'CF-IPCountry': 'CO' } })
    expect(readShopperCountry(request)).toBe('CO')
  })

  test('falls back to the header when `cf` carries no country', () => {
    const request = Object.assign(new Request('https://store.test/', { headers: { 'CF-IPCountry': 'CO' } }), {
      cf: {},
    })
    expect(readShopperCountry(request)).toBe('CO')
  })

  test('has no country off the edge', () => {
    expect(readShopperCountry(new Request('http://localhost:3000/'))).toBeUndefined()
  })
})

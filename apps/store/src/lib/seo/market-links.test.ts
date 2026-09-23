import { describe, expect, test } from 'vitest'
import { DEFAULT_MARKET, type Market, type MarketContext } from '#/lib/market'
import { marketHeadLinks } from './market-links'

const colombia: Market = { localeCode: 'es-CO', iso2: 'co', displayName: 'Colombia', currencyCode: 'cop' }
const markets: ReadonlyArray<Market> = [DEFAULT_MARKET, colombia]

function context(current: Market, resolvedFromUrl = true): MarketContext {
  return { current, markets, resolvedFromUrl }
}

describe('marketHeadLinks', () => {
  test('a product page is canonical at its own market address', () => {
    const links = marketHeadLinks(context(colombia), '/products/x')
    expect(links.filter((link) => link.rel === 'canonical')).toEqual([{ rel: 'canonical', href: '/es-CO/products/x' }])
  })

  test('every sellable market gets one alternate at the same path under its segment, plus x-default at /', () => {
    const links = marketHeadLinks(context(colombia), '/products/x')
    expect(links.filter((link) => link.rel === 'alternate')).toEqual([
      { rel: 'alternate', hrefLang: 'en-US', href: '/en-US/products/x' },
      { rel: 'alternate', hrefLang: 'es-CO', href: '/es-CO/products/x' },
      { rel: 'alternate', hrefLang: 'x-default', href: '/' },
    ])
  })

  test('the market home is addressed by its bare segment', () => {
    const links = marketHeadLinks(context(DEFAULT_MARKET), '/')
    expect(links).toContainEqual({ rel: 'canonical', href: '/en-US' })
    expect(links).toContainEqual({ rel: 'alternate', hrefLang: 'es-CO', href: '/es-CO' })
  })

  test('a page no market was resolved for declares nothing', () => {
    expect(marketHeadLinks(context(DEFAULT_MARKET, false), '/fr-FR/products')).toEqual([])
  })
})

import { describe, expect, it } from 'vitest'
import { buildPricePayload } from '#/features/products/utils/price-columns'

const currencyCodes = ['usd', 'cop']
const priceIdByCurrency = new Map([['usd', 'price_usd']])
const initial = { usd: '100', 'compareAt:usd': '120', cop: '', 'compareAt:cop': '' }

describe('buildPricePayload', () => {
  it('sends every priced currency whole, a compare-at-only edit included, and drops a compare-at without a price', () => {
    // Clearing the compare-at is the only edit: it still counts, and goes out as null rather than
    // being left off, which the endpoint would also read as a clear but only by accident.
    expect(buildPricePayload(currencyCodes, initial, { ...initial, 'compareAt:usd': '' }, priceIdByCurrency)).toEqual([
      { id: 'price_usd', currencyCode: 'usd', amount: '100', compareAtAmount: null },
    ])

    // An untouched currency goes back with its compare-at, and a new one gets its own; a compare-at
    // typed where there is no price is a change but sends nothing for that currency.
    expect(
      buildPricePayload(
        currencyCodes,
        initial,
        { ...initial, cop: '400000', 'compareAt:cop': '500000' },
        priceIdByCurrency,
      ),
    ).toEqual([
      { id: 'price_usd', currencyCode: 'usd', amount: '100', compareAtAmount: '120' },
      { currencyCode: 'cop', amount: '400000', compareAtAmount: '500000' },
    ])
    expect(
      buildPricePayload(currencyCodes, initial, { ...initial, 'compareAt:cop': '500000' }, priceIdByCurrency),
    ).toEqual([{ id: 'price_usd', currencyCode: 'usd', amount: '100', compareAtAmount: '120' }])

    expect(buildPricePayload(currencyCodes, initial, initial, priceIdByCurrency)).toBeUndefined()
  })
})

import { afterAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { DEFAULT_MARKET } from '#/lib/market'
import { loadSellableMarkets } from './sellable-markets'

/**
 * The default market is the backend's answer, not the compiled one. The generated client is the
 * seam: each test states what the country endpoint returned, and the clock moves past every TTL so
 * the per-instance cache from the test before is already stale.
 */

const { listStoreCountries } = vi.hoisted(() => ({ listStoreCountries: vi.fn() }))
vi.mock('#/api/generated/countries/countries', () => ({ listStoreCountries }))

const colombia = { iso2: 'co', displayName: 'Colombia', currencyCode: 'cop', localeCode: 'es-CO' }
const unitedStates = { iso2: 'us', displayName: 'United States', currencyCode: 'usd', localeCode: 'en-US' }

const load = () => loadSellableMarkets()

vi.useFakeTimers({ toFake: ['Date'] })
afterAll(() => vi.useRealTimers())

beforeEach(() => {
  vi.setSystemTime(Date.now() + 60 * 60 * 1000)
  listStoreCountries.mockReset()
})

describe('loadSellableMarkets on the server', () => {
  test('takes the default market from the backend', async () => {
    listStoreCountries.mockResolvedValue({ countries: [colombia, unitedStates], defaultMarket: unitedStates })

    const { defaultMarket } = await load()

    expect(defaultMarket.localeCode).toBe('en-US')
  })

  test('boots on a default market other than the compiled one', async () => {
    listStoreCountries.mockResolvedValue({ countries: [colombia], defaultMarket: colombia })

    const sellable = await load()

    expect(sellable.defaultMarket.localeCode).toBe('es-CO')
    expect(sellable.markets.map((market) => market.localeCode)).toEqual(['es-CO'])
  })

  test('falls back to the compiled default when the backend is unreachable', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => undefined)
    listStoreCountries.mockRejectedValue(new TypeError('fetch failed'))

    const sellable = await load()

    expect(sellable).toEqual({ markets: [DEFAULT_MARKET], defaultMarket: DEFAULT_MARKET })
  })

  test('refuses a backend that names no default market', async () => {
    listStoreCountries.mockResolvedValue({ countries: [colombia], defaultMarket: null })

    await expect(load()).rejects.toThrow('The store has no default market')
  })
})

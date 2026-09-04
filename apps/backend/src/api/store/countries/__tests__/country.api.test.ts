import type { TestApi } from '@tests/setup/create-api.js'
import { type Fixtures, test } from '@tests/setup/test-extend.js'
import countryDefinitions from '../definitions.js'
import type * as countryRoutes from '../route.js'

type Factories = Fixtures['factories']

let api: TestApi

test.beforeEach(async ({ createApi }) => {
  api = await createApi({ definitions: countryDefinitions })
})

/**
 * Two sellable countries whose display names sort the opposite way to their codes, so the assertion
 * on order cannot pass by accident, plus one country left outside every region.
 */
const createMarkets = async (factories: Factories) => {
  const region = await factories.create.region({ name: 'Colombia', currencyCode: 'cop' })
  const zed = await factories.create.country({
    id: 'zz',
    displayName: 'Andes',
    regionId: region.id,
    localeCode: 'es-CO',
  })
  const alpha = await factories.create.country({
    id: 'aa',
    displayName: 'Zapata',
    regionId: region.id,
    localeCode: 'es-CO',
  })
  const unsellable = await factories.create.country({ id: 'qq', displayName: 'Nowhere' })

  return { region, zed, alpha, unsellable }
}

test.describe('GET /store/countries', () => {
  test('returns only the countries an owning region sells to', async ({ expect, factories }) => {
    const { unsellable } = await createMarkets(factories)

    const response = await api.get<typeof countryRoutes.GetOutput>('/store/countries')

    expect(response.status).toBe(200)
    expect(response.body.countries).toEqual([
      { iso2: 'zz', displayName: 'Andes', currencyCode: 'cop', localeCode: 'es-CO' },
      { iso2: 'aa', displayName: 'Zapata', currencyCode: 'cop', localeCode: 'es-CO' },
    ])
    expect(response.body.countries.map((country) => country.iso2)).not.toContain(unsellable.id)
  })

  test('sorts by display name rather than by code', async ({ expect, factories }) => {
    await createMarkets(factories)

    const response = await api.get<typeof countryRoutes.GetOutput>('/store/countries')

    expect(response.body.countries.map((country) => country.displayName)).toEqual(['Andes', 'Zapata'])
  })

  test('returns every ISO country under scope=all', async ({ expect, factories }) => {
    await createMarkets(factories)

    const response = await api.get<typeof countryRoutes.GetOutput>('/store/countries', undefined, {
      query: { scope: 'all' },
    })

    expect(response.status).toBe(200)
    expect(response.body.countries.map((country) => country.displayName)).toEqual(['Andes', 'Nowhere', 'Zapata'])
  })

  test('gives a country outside every region a null currency and locale', async ({ expect, factories }) => {
    await createMarkets(factories)

    const response = await api.get<typeof countryRoutes.GetOutput>('/store/countries', undefined, {
      query: { scope: 'all' },
    })

    expect(response.body.countries).toContainEqual({
      iso2: 'qq',
      displayName: 'Nowhere',
      currencyCode: null,
      localeCode: null,
    })
  })

  test('rejects an unknown scope', async ({ expect }) => {
    const response = await api.get('/store/countries', undefined, { query: { scope: 'sellable-ish' } })

    expect(response.status).toBe(400)
  })
})

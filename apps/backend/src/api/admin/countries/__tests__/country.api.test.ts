import type { ApiErrorBody, TestApi } from '@tests/setup/create-api.js'
import { test } from '@tests/setup/test-extend.js'
import { authHeader } from '@tests/utils/auth-header.js'
import countryDefinitions from '../definitions.js'
import type * as countryRoutes from '../route.js'

let api: TestApi

test.beforeEach(async ({ createApi }) => {
  api = await createApi({ definitions: countryDefinitions })
})

const listCountries = (query?: Record<string, unknown>) =>
  api.get<typeof countryRoutes.GetOutput>('/admin/countries', undefined, query ? { query } : undefined)

test.describe('GET /admin/countries', () => {
  test('lists countries with the region that sells to them and the locale it reads them in', async ({
    expect,
    factories,
  }) => {
    const region = await factories.create.region({ name: 'Colombia', currencyCode: 'cop' })
    await factories.create.country({ id: 'co', displayName: 'Colombia', regionId: region.id, localeCode: 'es-CO' })
    await factories.create.country({ id: 'jp', displayName: 'Japan' })

    const { status, body } = await listCountries()

    expect(status).toBe(200)
    expect(body).toMatchObject({ count: 2, offset: 0, limit: 20 })
    // Display name order, so the picker reads alphabetically without sorting accented names itself.
    expect(body.countries).toEqual([
      { id: 'co', displayName: 'Colombia', regionId: region.id, localeCode: 'es-CO' },
      // The nulls are what the picker filters on: a country no region sells to is one it may offer.
      { id: 'jp', displayName: 'Japan', regionId: null, localeCode: null },
    ])
  })

  test('narrows to one region, which is what the region detail page asks for', async ({ expect, factories }) => {
    const europe = await factories.create.region({ name: 'Europe', currencyCode: 'eur' })
    const americas = await factories.create.region({ name: 'Americas', currencyCode: 'usd' })
    await factories.create.country({ id: 'fr', displayName: 'France', regionId: europe.id, localeCode: 'fr-FR' })
    await factories.create.country({
      id: 'us',
      displayName: 'United States',
      regionId: americas.id,
      localeCode: 'en-US',
    })
    await factories.create.country({ id: 'jp', displayName: 'Japan' })

    const { body } = await listCountries({ regionId: europe.id })

    expect(body.count).toBe(1)
    expect(body.countries.map((country) => country.id)).toEqual(['fr'])
  })

  test('searches by display name and by the alpha-2 code the Code column shows', async ({ expect, factories }) => {
    await factories.create.country({ id: 'co', displayName: 'Colombia' })
    await factories.create.country({ id: 'jp', displayName: 'Japan' })

    const byName = await listCountries({ q: 'colom' })
    const byCode = await listCountries({ q: 'jp' })

    expect(byName.body.countries.map((country) => country.id)).toEqual(['co'])
    expect(byCode.body.countries.map((country) => country.id)).toEqual(['jp'])
  })

  test('takes a limit past the shared ceiling, so the picker gets the ISO list in one request', async ({
    expect,
    factories,
  }) => {
    await factories.create.country({ id: 'co', displayName: 'Colombia' })

    const { status, body } = await listCountries({ limit: 300 })

    expect(status).toBe(200)
    expect(body.limit).toBe(300)
  })

  test('pages, and reports the total rather than the page size', async ({ expect, factories }) => {
    await factories.create.country({ id: 'co', displayName: 'Colombia' })
    await factories.create.country({ id: 'jp', displayName: 'Japan' })

    const { body } = await listCountries({ limit: 1, offset: 1 })

    expect(body).toMatchObject({ count: 2, offset: 1, limit: 1 })
    expect(body.countries.map((country) => country.id)).toEqual(['jp'])
  })

  test('refuses a request carrying no credential', async ({ expect, createApi, factories }) => {
    const authed = await createApi({ definitions: countryDefinitions, namespaceAuth: true })
    await factories.create.country({ id: 'co', displayName: 'Colombia' })

    const anonymous = await authed.get<ApiErrorBody>('/admin/countries')
    const staff = await authed.get<typeof countryRoutes.GetOutput>('/admin/countries', undefined, {
      headers: authHeader('user', 'user_admin'),
    })

    expect(anonymous.status).toBe(401)
    expect(staff.status).toBe(200)
  })
})

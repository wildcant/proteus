import { ErrorTypes } from '@core/errors/app-error.js'
import type { ApiErrorBody, TestApi } from '@tests/setup/create-api.js'
import { type Fixtures, test } from '@tests/setup/test-extend.js'
import { authHeader } from '@tests/utils/auth-header.js'
import countryDefinitions from '../../countries/definitions.js'
import type * as countryRoutes from '../../countries/route.js'
import type * as regionCountryRoutes from '../[id]/countries/[code]/route.js'
import type * as regionCountriesRoutes from '../[id]/countries/route.js'
import type * as regionByIdRoutes from '../[id]/route.js'
import regionDefinitions from '../definitions.js'
import type * as regionRoutes from '../route.js'

type Factories = Fixtures['factories']

/**
 * The two providers the payment module's loader registers and seeds when the container boots.
 * A test cannot add a third — the loader owns the module's private container — so these are what
 * a region gets to offer.
 */
const MANUAL_PROVIDER_ID = 'pp_system_default'
const STRIPE_PROVIDER_ID = 'pp_stripe_default'

let api: TestApi

// The country list route is mounted alongside the region routes because it is how the region's
// Countries card reads its rows — asserting on `regionId` and `localeCode` through it is asserting
// on what that card actually shows, rather than on a projection only this test knows about.
test.beforeEach(async ({ createApi }) => {
  api = await createApi({ definitions: [...regionDefinitions, ...countryDefinitions] })
})

/** ILLO-47's two markets as store currencies. A region may only be denominated in one of these. */
const createStoreSellingIn = async (factories: Factories, ...currencyCodes: string[]) => {
  const store = await factories.create.store({ name: 'Proteus' })
  for (const currencyCode of currencyCodes) {
    await factories.create.storeCurrency({ storeId: store.id, currencyCode })
  }
  return store
}

const createRegion = (body: object) => api.post<typeof regionRoutes.PostOutput>('/admin/regions', body)

const getRegion = (id: string) => api.get<typeof regionByIdRoutes.GetOutput>(`/admin/regions/${id}`)

const updateRegion = (id: string, body: object) =>
  api.post<typeof regionByIdRoutes.PostOutput>(`/admin/regions/${id}`, body)

const assignCountries = (id: string, body: object) =>
  api.post<typeof regionCountriesRoutes.PostOutput>(`/admin/regions/${id}/countries`, body)

const updateCountryLocale = (id: string, code: string, body: object) =>
  api.post<typeof regionCountryRoutes.PostOutput>(`/admin/regions/${id}/countries/${code}`, body)

const listCountries = async (query?: Record<string, unknown>) => {
  const { body } = await api.get<typeof countryRoutes.GetOutput>(
    '/admin/countries',
    undefined,
    query ? { query } : undefined,
  )
  return body.countries
}

const listRegionCountries = (regionId: string) => listCountries({ regionId })

test.describe('POST /admin/regions', () => {
  test('creates a region with a name, a currency and the providers it offers', async ({ expect, factories }) => {
    await createStoreSellingIn(factories, 'usd', 'cop')

    const { status, body } = await createRegion({
      name: 'Colombia',
      currencyCode: 'cop',
      paymentProviderIds: [STRIPE_PROVIDER_ID],
    })

    expect(status).toBe(201)
    expect(body.region).toMatchObject({ name: 'Colombia', currencyCode: 'cop' })
    expect(body.region.paymentProviders).toEqual([{ id: STRIPE_PROVIDER_ID, isEnabled: true }])
    // Countries are assigned on their own screen, so a region starts selling to none.
    expect(body.region.countries).toEqual([])
  })

  test('accepts the currency in any case, since every price row carries the lowercase form', async ({
    expect,
    factories,
  }) => {
    await createStoreSellingIn(factories, 'usd')

    const { status, body } = await createRegion({ name: 'United States', currencyCode: 'USD' })

    expect(status).toBe(201)
    expect(body.region.currencyCode).toBe('usd')
  })

  test('refuses a currency the store does not sell in, and creates nothing', async ({ expect, factories }) => {
    // The rejection criterion: a region denominated in money the store has no prices in is a
    // market whose products can never be priced, so it must not come into existence at all.
    await createStoreSellingIn(factories, 'usd', 'cop')

    const { status, body } = await api.post<ApiErrorBody>('/admin/regions', { name: 'Japan', currencyCode: 'jpy' })

    expect(status).toBe(400)
    expect(body.type).toBe(ErrorTypes.INVALID_DATA)
    expect(body.message).toContain('jpy')
    const { body: list } = await api.get<typeof regionRoutes.GetOutput>('/admin/regions')
    expect(list.regions).toEqual([])
  })

  test('a store with no currencies configured can have no regions', async ({ expect, factories }) => {
    await createStoreSellingIn(factories)

    const { status } = await api.post<ApiErrorBody>('/admin/regions', { name: 'Nowhere', currencyCode: 'usd' })

    expect(status).toBe(400)
  })
})

test.describe('GET /admin/regions/:id', () => {
  test('returns the region with the countries it sells to and the providers it offers', async ({
    expect,
    factories,
  }) => {
    await createStoreSellingIn(factories, 'eur')
    const region = await factories.create.region({ name: 'Europe', currencyCode: 'eur' })
    await factories.create.country({ id: 'dk', displayName: 'Denmark', regionId: region.id, localeCode: 'da-DK' })
    await factories.create.country({ id: 'fr', displayName: 'France', regionId: region.id, localeCode: 'fr-FR' })
    await factories.create.regionPaymentProvider({ regionId: region.id, paymentProviderId: MANUAL_PROVIDER_ID })

    const { status, body } = await getRegion(region.id)

    expect(status).toBe(200)
    expect(body.region).toMatchObject({ id: region.id, name: 'Europe', currencyCode: 'eur' })
    expect(body.region.countries.map((country) => country.displayName).sort()).toEqual(['Denmark', 'France'])
    expect(body.region.paymentProviders).toEqual([{ id: MANUAL_PROVIDER_ID, isEnabled: true }])
  })

  test('a country belonging to another region is not listed under this one', async ({ expect, factories }) => {
    const europe = await factories.create.region({ name: 'Europe', currencyCode: 'eur' })
    const americas = await factories.create.region({ name: 'Americas', currencyCode: 'usd' })
    await factories.create.country({ id: 'fr', displayName: 'France', regionId: europe.id, localeCode: 'fr-FR' })
    await factories.create.country({
      id: 'us',
      displayName: 'United States',
      regionId: americas.id,
      localeCode: 'en-US',
    })
    // Sold to by nobody, so it belongs to neither list.
    await factories.create.country({ id: 'jp', displayName: 'Japan' })

    const { body } = await getRegion(europe.id)

    expect(body.region.countries).toEqual([{ id: 'fr', displayName: 'France' }])
  })

  test('an unknown region is a 404', async ({ expect }) => {
    const { status } = await api.get<ApiErrorBody>('/admin/regions/reg_missing')

    expect(status).toBe(404)
  })
})

test.describe('POST /admin/regions/:id', () => {
  test('renames a region, redenominates it and replaces its providers', async ({ expect, factories }) => {
    await createStoreSellingIn(factories, 'usd', 'cop')
    const region = await factories.create.region({ name: 'Colombia', currencyCode: 'usd' })
    await factories.create.regionPaymentProvider({ regionId: region.id, paymentProviderId: MANUAL_PROVIDER_ID })

    const { status, body } = await updateRegion(region.id, {
      name: 'Colombia (COP)',
      currencyCode: 'cop',
      paymentProviderIds: [STRIPE_PROVIDER_ID],
    })

    expect(status).toBe(200)
    expect(body.region).toMatchObject({ name: 'Colombia (COP)', currencyCode: 'cop' })
    // Replaced, not merged: the editor shows the whole set, so an absent provider is a removal.
    expect(body.region.paymentProviders).toEqual([{ id: STRIPE_PROVIDER_ID, isEnabled: true }])
    expect((await getRegion(region.id)).body.region.paymentProviders).toEqual([
      { id: STRIPE_PROVIDER_ID, isEnabled: true },
    ])
  })

  test('a payload that does not mention providers leaves them alone', async ({ expect, factories }) => {
    await createStoreSellingIn(factories, 'usd')
    const region = await factories.create.region({ name: 'United States', currencyCode: 'usd' })
    await factories.create.regionPaymentProvider({ regionId: region.id, paymentProviderId: MANUAL_PROVIDER_ID })

    const { body } = await updateRegion(region.id, { name: 'USA' })

    expect(body.region.name).toBe('USA')
    expect(body.region.paymentProviders).toEqual([{ id: MANUAL_PROVIDER_ID, isEnabled: true }])
  })

  test('an empty provider list removes every provider', async ({ expect, factories }) => {
    await createStoreSellingIn(factories, 'usd')
    const region = await factories.create.region({ name: 'United States', currencyCode: 'usd' })
    await factories.create.regionPaymentProvider({ regionId: region.id, paymentProviderId: MANUAL_PROVIDER_ID })

    const { body } = await updateRegion(region.id, { paymentProviderIds: [] })

    expect(body.region.paymentProviders).toEqual([])
  })

  test('refuses a currency the store does not sell in, and leaves the region as it was', async ({
    expect,
    factories,
  }) => {
    await createStoreSellingIn(factories, 'usd')
    const region = await factories.create.region({ name: 'United States', currencyCode: 'usd' })

    const { status, body } = await api.post<ApiErrorBody>(`/admin/regions/${region.id}`, {
      name: 'Japan',
      currencyCode: 'jpy',
    })

    expect(status).toBe(400)
    expect(body.type).toBe(ErrorTypes.INVALID_DATA)
    // The name travelled in the same payload, so the refusal has to take it with it.
    expect((await getRegion(region.id)).body.region).toMatchObject({ name: 'United States', currencyCode: 'usd' })
  })
})

test.describe('GET /admin/regions', () => {
  test('lists every region with its countries and providers', async ({ expect, factories }) => {
    const colombia = await factories.create.region({ name: 'Colombia', currencyCode: 'cop' })
    const unitedStates = await factories.create.region({ name: 'United States', currencyCode: 'usd' })
    await factories.create.country({ id: 'co', displayName: 'Colombia', regionId: colombia.id, localeCode: 'es-CO' })
    await factories.create.regionPaymentProvider({ regionId: unitedStates.id, paymentProviderId: STRIPE_PROVIDER_ID })

    const { status, body } = await api.get<typeof regionRoutes.GetOutput>('/admin/regions')

    expect(status).toBe(200)
    expect(body).toMatchObject({ count: 2, offset: 0, limit: 20 })
    expect(body.regions.map((region) => region.name)).toEqual(['Colombia', 'United States'])
    expect(body.regions[0]?.countries).toEqual([{ id: 'co', displayName: 'Colombia' }])
    expect(body.regions[1]?.paymentProviders).toEqual([{ id: STRIPE_PROVIDER_ID, isEnabled: true }])
  })

  test('searches by name', async ({ expect, factories }) => {
    await factories.create.region({ name: 'Colombia', currencyCode: 'cop' })
    await factories.create.region({ name: 'United States', currencyCode: 'usd' })

    const { body } = await api.get<typeof regionRoutes.GetOutput>('/admin/regions', undefined, {
      query: { q: 'colom' },
    })

    expect(body.count).toBe(1)
    expect(body.regions[0]?.name).toBe('Colombia')
  })

  test('pages, and reports the total rather than the page size', async ({ expect, factories }) => {
    await factories.create.region({ name: 'Colombia', currencyCode: 'cop' })
    await factories.create.region({ name: 'United States', currencyCode: 'usd' })

    const { body } = await api.get<typeof regionRoutes.GetOutput>('/admin/regions', undefined, {
      query: { limit: 1, offset: 1 },
    })

    expect(body).toMatchObject({ count: 2, offset: 1, limit: 1 })
    expect(body.regions.map((region) => region.name)).toEqual(['United States'])
  })
})

test.describe('region routes', () => {
  test('expose no way to delete a region', ({ expect }) => {
    // A region owns live carts, orders and prices. Nothing in this feature makes removing one
    // safe, so the absence of a DELETE is the decision, not an omission.
    //
    // Scoped to the region's own matchers, because `/admin/regions/:id/countries/:code` does have
    // one: unassigning a country closes a market the region still exists to serve, which is the
    // reversible half of the decision above.
    const regionItself = regionDefinitions.filter(
      (definition) => definition.matcher === '/admin/regions' || definition.matcher === '/admin/regions/:id',
    )

    expect(regionItself.map((definition) => definition.method)).not.toContain('DELETE')
  })

  test('refuse a request carrying no credential', async ({ expect, createApi, factories }) => {
    const authed = await createApi({ definitions: regionDefinitions, namespaceAuth: true })
    await factories.create.region({ name: 'Colombia', currencyCode: 'cop' })

    const anonymous = await authed.get<ApiErrorBody>('/admin/regions')
    const staff = await authed.get<typeof regionRoutes.GetOutput>('/admin/regions', undefined, {
      headers: authHeader('user', 'user_admin'),
    })

    expect(anonymous.status).toBe(401)
    expect(staff.status).toBe(200)
  })
})

test.describe('POST /admin/regions/:id/countries', () => {
  test('makes a country sellable: region and locale are both set by the one request', async ({ expect, factories }) => {
    const region = await factories.create.region({ name: 'Colombia', currencyCode: 'cop' })
    await factories.create.country({ id: 'co', displayName: 'Colombia' })

    const { status, body } = await assignCountries(region.id, {
      countries: [{ id: 'co', localeCode: 'es-CO' }],
    })

    expect(status).toBe(200)
    expect(body.countries).toEqual([{ id: 'co', displayName: 'Colombia', regionId: region.id, localeCode: 'es-CO' }])
    expect((await getRegion(region.id)).body.region.countries).toEqual([{ id: 'co', displayName: 'Colombia' }])
  })

  test('refuses an assignment carrying no locale, and assigns nothing', async ({ expect, factories }) => {
    // The rejection this whole route exists for. `regionId` is what makes a country sellable and
    // `localeCode` is what its storefront's URL segment, `lang` attribute and every number and date
    // formatter come from — so a country assigned without one is a market that renders broken, and
    // the admin must not be the path that produces one.
    const region = await factories.create.region({ name: 'Colombia', currencyCode: 'cop' })
    await factories.create.country({ id: 'co', displayName: 'Colombia' })

    const { status, body } = await api.post<ApiErrorBody>(`/admin/regions/${region.id}/countries`, {
      countries: [{ id: 'co' }],
    })

    expect(status).toBe(400)
    expect(body.type).toBe(ErrorTypes.INVALID_DATA)
    expect((await getRegion(region.id)).body.region.countries).toEqual([])
  })

  test('refuses a locale that is empty or only whitespace', async ({ expect, factories }) => {
    const region = await factories.create.region({ name: 'Colombia', currencyCode: 'cop' })
    await factories.create.country({ id: 'co', displayName: 'Colombia' })

    const empty = await api.post<ApiErrorBody>(`/admin/regions/${region.id}/countries`, {
      countries: [{ id: 'co', localeCode: '' }],
    })
    const blank = await api.post<ApiErrorBody>(`/admin/regions/${region.id}/countries`, {
      countries: [{ id: 'co', localeCode: '   ' }],
    })

    expect(empty.status).toBe(400)
    expect(blank.status).toBe(400)
    expect((await getRegion(region.id)).body.region.countries).toEqual([])
  })

  test('refuses a locale that is not a well-formed BCP 47 tag, and assigns nothing', async ({ expect, factories }) => {
    // `es_CO` is the POSIX form and the most ordinary locale typo there is — non-empty, five
    // characters, and past every length check. What it costs is not a mis-formatted price: the
    // storefront would list Colombia as sellable and hand that tag to `Intl.NumberFormat`, which
    // throws on every priced page in the market. Length was never the property worth checking.
    const region = await factories.create.region({ name: 'Colombia', currencyCode: 'cop' })
    await factories.create.country({ id: 'co', displayName: 'Colombia' })

    const { status, body } = await api.post<ApiErrorBody>(`/admin/regions/${region.id}/countries`, {
      countries: [{ id: 'co', localeCode: 'es_CO' }],
    })

    expect(status).toBe(400)
    expect(body.type).toBe(ErrorTypes.INVALID_DATA)
    expect((await getRegion(region.id)).body.region.countries).toEqual([])
  })

  test('accepts the BCP 47 tags a market legitimately needs, not only language-REGION', async ({
    expect,
    factories,
  }) => {
    // The other half of the check: it narrows the field to what a formatter takes and no further.
    // A variant subtag, a script subtag and a UN M.49 region are all tags a real market runs on.
    const region = await factories.create.region({ name: 'Europe', currencyCode: 'eur' })
    await factories.create.country({ id: 'es', displayName: 'Spain' })
    await factories.create.country({ id: 'rs', displayName: 'Serbia' })
    await factories.create.country({ id: 'ar', displayName: 'Argentina' })

    const { status, body } = await assignCountries(region.id, {
      countries: [
        { id: 'es', localeCode: 'ca-ES-valencia' },
        { id: 'rs', localeCode: 'sr-Latn-RS' },
        { id: 'ar', localeCode: 'es-419' },
      ],
    })

    expect(status).toBe(200)
    expect(body.countries.map((country) => country.localeCode)).toEqual(['ca-ES-valencia', 'sr-Latn-RS', 'es-419'])
  })

  test('accepts the country code in any case, since every country row carries the lowercase form', async ({
    expect,
    factories,
  }) => {
    const region = await factories.create.region({ name: 'Colombia', currencyCode: 'cop' })
    await factories.create.country({ id: 'co', displayName: 'Colombia' })

    const { status, body } = await assignCountries(region.id, { countries: [{ id: 'CO', localeCode: 'es-CO' }] })

    expect(status).toBe(200)
    expect(body.countries[0]?.id).toBe('co')
  })

  test('refuses a country another region already sells to, and leaves it where it was', async ({
    expect,
    factories,
  }) => {
    const europe = await factories.create.region({ name: 'Europe', currencyCode: 'eur' })
    const nordics = await factories.create.region({ name: 'Nordics', currencyCode: 'eur' })
    await factories.create.country({ id: 'dk', displayName: 'Denmark', regionId: europe.id, localeCode: 'da-DK' })

    const { status, body } = await api.post<ApiErrorBody>(`/admin/regions/${nordics.id}/countries`, {
      countries: [{ id: 'dk', localeCode: 'da-DK' }],
    })

    expect(status).toBe(409)
    expect(body.type).toBe(ErrorTypes.CONFLICT)
    expect((await getRegion(europe.id)).body.region.countries).toEqual([{ id: 'dk', displayName: 'Denmark' }])
  })

  test('assigns none of them when one country in the batch is refused', async ({ expect, factories }) => {
    // Every country is its own compensating step, so a batch that fails halfway is unwound rather
    // than left half-applied — a merchant reading the table afterwards sees what they asked for or
    // nothing at all, never some of it.
    const europe = await factories.create.region({ name: 'Europe', currencyCode: 'eur' })
    const nordics = await factories.create.region({ name: 'Nordics', currencyCode: 'eur' })
    await factories.create.country({ id: 'se', displayName: 'Sweden' })
    await factories.create.country({ id: 'dk', displayName: 'Denmark', regionId: europe.id, localeCode: 'da-DK' })

    const { status } = await api.post<ApiErrorBody>(`/admin/regions/${nordics.id}/countries`, {
      countries: [
        { id: 'se', localeCode: 'sv-SE' },
        { id: 'dk', localeCode: 'da-DK' },
      ],
    })

    expect(status).toBe(409)
    expect((await getRegion(nordics.id)).body.region.countries).toEqual([])
  })

  test('re-assigning a country already in this region repoints its locale', async ({ expect, factories }) => {
    const region = await factories.create.region({ name: 'Colombia', currencyCode: 'cop' })
    await factories.create.country({ id: 'co', displayName: 'Colombia', regionId: region.id, localeCode: 'en-CO' })

    const { status, body } = await assignCountries(region.id, { countries: [{ id: 'co', localeCode: 'es-CO' }] })

    expect(status).toBe(200)
    expect(body.countries[0]?.localeCode).toBe('es-CO')
  })

  test('an unknown region is a 404, and an unknown country code is too', async ({ expect, factories }) => {
    const region = await factories.create.region({ name: 'Colombia', currencyCode: 'cop' })
    await factories.create.country({ id: 'co', displayName: 'Colombia' })

    const unknownRegion = await api.post<ApiErrorBody>('/admin/regions/reg_missing/countries', {
      countries: [{ id: 'co', localeCode: 'es-CO' }],
    })
    // The ISO 3166-1 table ships whole and is never authored, so a code naming no row is a client
    // sending a country that does not exist, not a country to create.
    const unknownCountry = await api.post<ApiErrorBody>(`/admin/regions/${region.id}/countries`, {
      countries: [{ id: 'zz', localeCode: 'en-ZZ' }],
    })

    expect(unknownRegion.status).toBe(404)
    expect(unknownCountry.status).toBe(404)
  })
})

test.describe('POST /admin/regions/:id/countries/:code', () => {
  test('repoints a country to another locale', async ({ expect, factories }) => {
    const region = await factories.create.region({ name: 'Colombia', currencyCode: 'cop' })
    await factories.create.country({ id: 'co', displayName: 'Colombia', regionId: region.id, localeCode: 'en-CO' })

    const { status, body } = await updateCountryLocale(region.id, 'co', { localeCode: 'es-CO' })

    expect(status).toBe(200)
    expect(body.country).toEqual({ id: 'co', displayName: 'Colombia', regionId: region.id, localeCode: 'es-CO' })
  })

  test('refuses an empty locale, so an edit cannot break what an assignment could not', async ({
    expect,
    factories,
  }) => {
    const region = await factories.create.region({ name: 'Colombia', currencyCode: 'cop' })
    await factories.create.country({ id: 'co', displayName: 'Colombia', regionId: region.id, localeCode: 'es-CO' })

    const { status } = await api.post<ApiErrorBody>(`/admin/regions/${region.id}/countries/co`, { localeCode: '  ' })

    expect(status).toBe(400)
    expect((await listRegionCountries(region.id))[0]?.localeCode).toBe('es-CO')
  })

  test('refuses a locale that is not a well-formed BCP 47 tag, and leaves the market as it was', async ({
    expect,
    factories,
  }) => {
    // This route is the reachable path for the typo: its own copy invites a merchant to retype the
    // field. An edit that can strand a live market defeats the assignment's guarantee from the
    // other direction, so the same primitive refuses it here.
    const region = await factories.create.region({ name: 'Colombia', currencyCode: 'cop' })
    await factories.create.country({ id: 'co', displayName: 'Colombia', regionId: region.id, localeCode: 'es-CO' })

    const { status, body } = await api.post<ApiErrorBody>(`/admin/regions/${region.id}/countries/co`, {
      localeCode: 'es_CO',
    })

    expect(status).toBe(400)
    expect(body.type).toBe(ErrorTypes.INVALID_DATA)
    expect((await listRegionCountries(region.id))[0]?.localeCode).toBe('es-CO')
  })

  test('a country another region sells to is not this one to edit', async ({ expect, factories }) => {
    const europe = await factories.create.region({ name: 'Europe', currencyCode: 'eur' })
    const nordics = await factories.create.region({ name: 'Nordics', currencyCode: 'eur' })
    await factories.create.country({ id: 'dk', displayName: 'Denmark', regionId: europe.id, localeCode: 'da-DK' })

    const { status } = await api.post<ApiErrorBody>(`/admin/regions/${nordics.id}/countries/dk`, {
      localeCode: 'en-DK',
    })

    expect(status).toBe(404)
    expect((await listRegionCountries(europe.id))[0]?.localeCode).toBe('da-DK')
  })
})

test.describe('DELETE /admin/regions/:id/countries/:code', () => {
  test('closes the market: the country keeps neither its region nor its locale', async ({ expect, factories }) => {
    // Both columns, not only `regionId`. A country left holding a locale it is not sellable in
    // reads as a half-open market to everything that inspects it, the next assignment included.
    const region = await factories.create.region({ name: 'Colombia', currencyCode: 'cop' })
    await factories.create.country({ id: 'co', displayName: 'Colombia', regionId: region.id, localeCode: 'es-CO' })

    const { status, body } = await api.delete<typeof regionCountryRoutes.DeleteOutput>(
      `/admin/regions/${region.id}/countries/co`,
    )

    expect(status).toBe(200)
    expect(body).toEqual({ id: 'co', deleted: true })
    expect((await getRegion(region.id)).body.region.countries).toEqual([])
    expect((await listCountries({ q: 'co' })).find((country) => country.id === 'co')).toEqual({
      id: 'co',
      displayName: 'Colombia',
      regionId: null,
      localeCode: null,
    })
  })

  test('removes several one at a time, which is what the table does with a bulk selection', async ({
    expect,
    factories,
  }) => {
    const region = await factories.create.region({ name: 'Europe', currencyCode: 'eur' })
    await factories.create.country({ id: 'dk', displayName: 'Denmark', regionId: region.id, localeCode: 'da-DK' })
    await factories.create.country({ id: 'fr', displayName: 'France', regionId: region.id, localeCode: 'fr-FR' })

    await api.delete(`/admin/regions/${region.id}/countries/dk`)
    await api.delete(`/admin/regions/${region.id}/countries/fr`)

    expect((await getRegion(region.id)).body.region.countries).toEqual([])
  })

  test('a country another region sells to is not this one to remove', async ({ expect, factories }) => {
    const europe = await factories.create.region({ name: 'Europe', currencyCode: 'eur' })
    const nordics = await factories.create.region({ name: 'Nordics', currencyCode: 'eur' })
    await factories.create.country({ id: 'dk', displayName: 'Denmark', regionId: europe.id, localeCode: 'da-DK' })

    const { status } = await api.delete<ApiErrorBody>(`/admin/regions/${nordics.id}/countries/dk`)

    expect(status).toBe(404)
    expect((await getRegion(europe.id)).body.region.countries).toEqual([{ id: 'dk', displayName: 'Denmark' }])
  })
})

import { ErrorTypes } from '@core/errors/app-error.js'
import type { ApiErrorBody, TestApi } from '@tests/setup/create-api.js'
import { type Fixtures, test } from '@tests/setup/test-extend.js'
import { authHeader } from '@tests/utils/auth-header.js'
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

test.beforeEach(async ({ createApi }) => {
  api = await createApi({ definitions: regionDefinitions })
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
    expect(regionDefinitions.map((definition) => definition.method)).not.toContain('DELETE')
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

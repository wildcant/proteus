import { ErrorTypes } from '@core/errors/app-error.js'
import type { ApiErrorBody, TestApi } from '@tests/setup/create-api.js'
import { type Fixtures, test } from '@tests/setup/test-extend.js'
import { authHeader } from '@tests/utils/auth-header.js'
import type * as storeCurrencyDefaultRoutes from '../currencies/[code]/default/route.js'
import type * as storeCurrencyRoutes from '../currencies/[code]/route.js'
import type * as storeCurrenciesRoutes from '../currencies/route.js'
import storeDefinitions from '../definitions.js'
import type * as storeRoutes from '../route.js'

type Factories = Fixtures['factories']

let api: TestApi

test.beforeEach(async ({ createApi }) => {
  api = await createApi({ definitions: storeDefinitions })
})

/** A store selling in both of ILLO-47's markets, with the United States as its default. */
const createStoreWithCurrencies = async (factories: Factories) => {
  const store = await factories.create.store({ name: 'Proteus' })
  await factories.create.storeCurrency({ storeId: store.id, currencyCode: 'cop' })
  await factories.create.storeCurrency({ storeId: store.id, currencyCode: 'usd', isDefault: true })
  return store
}

const getStore = () => api.get<typeof storeRoutes.GetOutput>('/admin/store')

const updateStore = (body: object) => api.post<typeof storeRoutes.PostOutput>('/admin/store', body)

const addCurrencies = (body: object) =>
  api.post<typeof storeCurrenciesRoutes.PostOutput>('/admin/store/currencies', body)

const makeDefault = (code: string) =>
  api.post<typeof storeCurrencyDefaultRoutes.PostOutput>(`/admin/store/currencies/${code}/default`)

const removeCurrency = (code: string) =>
  api.delete<typeof storeCurrencyRoutes.DeleteOutput>(`/admin/store/currencies/${code}`)

/** The codes the store trades in, in the order the API returns them — default first. */
const currencyCodes = (currencies: { currencyCode: string }[]) => currencies.map((currency) => currency.currencyCode)

test.describe('GET /admin/store', () => {
  test('returns the store with every currency it sells in', async ({ expect, factories }) => {
    const store = await createStoreWithCurrencies(factories)

    const { status, body } = await getStore()

    expect(status).toBe(200)
    expect(body.store).toMatchObject({ id: store.id, name: 'Proteus', defaultRegionId: null })
    // The default leads, then the rest alphabetically — the admin draws one price column per
    // currency in this order, so it is part of the answer rather than the caller's to impose.
    expect(body.store.currencies).toEqual([
      { currencyCode: 'usd', isDefault: true },
      { currencyCode: 'cop', isDefault: false },
    ])
  })

  test('carries the default region a shopper is served from', async ({ expect, factories }) => {
    const region = await factories.create.region({ name: 'United States', currencyCode: 'usd' })
    const store = await factories.create.store({ defaultRegionId: region.id })

    const { body } = await getStore()

    expect(body.store).toMatchObject({ id: store.id, defaultRegionId: region.id })
  })

  test('a store with no currencies configured yet answers with an empty list', async ({ expect, factories }) => {
    // Not an error: the store exists, it simply prices nothing yet. The price forms render no
    // currency column rather than falling back to one nobody chose.
    await factories.create.store()

    const { status, body } = await getStore()

    expect(status).toBe(200)
    expect(body.store.currencies).toEqual([])
  })

  test('a deployment with no store is a 404 rather than an empty body', async ({ expect }) => {
    const { status } = await api.get<ApiErrorBody>('/admin/store')

    expect(status).toBe(404)
  })

  test('refuses a request carrying no credential', async ({ expect, createApi, factories }) => {
    // `namespaceAuth` mounts the real `authenticate` middleware the server puts in front of every
    // /admin route, which is the subject of this test.
    const authed = await createApi({ definitions: storeDefinitions, namespaceAuth: true })
    await createStoreWithCurrencies(factories)

    const anonymous = await authed.get<ApiErrorBody>('/admin/store')
    const staff = await authed.get<typeof storeRoutes.GetOutput>('/admin/store', undefined, {
      headers: authHeader('user', 'user_admin'),
    })

    expect(anonymous.status).toBe(401)
    expect(staff.status).toBe(200)
  })
})

test.describe('POST /admin/store', () => {
  test('renames the store and points it at a default region, in one request', async ({ expect, factories }) => {
    await createStoreWithCurrencies(factories)
    const region = await factories.create.region({ name: 'Colombia', currencyCode: 'cop' })

    const { status, body } = await updateStore({ name: 'Proteus Store', defaultRegionId: region.id })

    expect(status).toBe(200)
    expect(body.store).toMatchObject({ name: 'Proteus Store', defaultRegionId: region.id })
    expect((await getStore()).body.store).toMatchObject({ name: 'Proteus Store', defaultRegionId: region.id })
  })

  test('leaves the fields the body does not mention alone', async ({ expect, factories }) => {
    // The Edit drawer saves a rename without resending a region it never showed the merchant, so
    // an omitted field has to mean "unchanged" rather than "cleared".
    const region = await factories.create.region({ name: 'Colombia', currencyCode: 'cop' })
    await factories.create.store({ name: 'Proteus', defaultRegionId: region.id })

    const { body } = await updateStore({ name: 'Renamed' })

    expect(body.store).toMatchObject({ name: 'Renamed', defaultRegionId: region.id })
  })

  test('clears the default region when the body sends null, which omitting it cannot say', async ({
    expect,
    factories,
  }) => {
    const region = await factories.create.region({ name: 'Colombia', currencyCode: 'cop' })
    await factories.create.store({ defaultRegionId: region.id })

    const { body } = await updateStore({ defaultRegionId: null })

    expect(body.store.defaultRegionId).toBeNull()
  })

  test('refuses a default region that does not exist, and changes nothing', async ({ expect, factories }) => {
    // `store.default_region_id` carries no foreign key — regions are another module — so an id
    // naming nothing would be stored happily and read back as a storefront serving from nowhere.
    await factories.create.store({ name: 'Proteus' })

    const { status, body } = await api.post<ApiErrorBody>('/admin/store', {
      name: 'Renamed',
      defaultRegionId: 'reg_nothing',
    })

    expect(status).toBe(400)
    expect(body.type).toBe(ErrorTypes.INVALID_DATA)
    expect(body.message).toContain('reg_nothing')
    expect((await getStore()).body.store.name).toBe('Proteus')
  })

  test('a deployment with no store is a 404', async ({ expect }) => {
    const { status } = await api.post<ApiErrorBody>('/admin/store', { name: 'Proteus' })

    expect(status).toBe(404)
  })
})

test.describe('POST /admin/store/currencies', () => {
  test('adds a currency, which is what makes it a price column in the variant editor', async ({
    expect,
    factories,
  }) => {
    await createStoreWithCurrencies(factories)

    const { status, body } = await addCurrencies({ currencyCodes: ['eur'] })

    expect(status).toBe(200)
    expect(currencyCodes(body.store.currencies)).toEqual(['usd', 'cop', 'eur'])
    expect(currencyCodes((await getStore()).body.store.currencies)).toEqual(['usd', 'cop', 'eur'])
  })

  test('takes the code in any case, since every price row carries the lowercase form', async ({
    expect,
    factories,
  }) => {
    await createStoreWithCurrencies(factories)

    const { body } = await addCurrencies({ currencyCodes: ['EUR'] })

    expect(currencyCodes(body.store.currencies)).toContain('eur')
  })

  test('the first currency a store trades in becomes its default', async ({ expect, factories }) => {
    // Otherwise the Store card names no money at all, and the price editor leads with a column
    // nobody chose. A store only reaches this state before its first currency: removing the
    // default is refused.
    await factories.create.store({ name: 'Proteus' })

    const { body } = await addCurrencies({ currencyCodes: ['cop', 'usd'] })

    expect(body.store.currencies).toEqual([
      { currencyCode: 'cop', isDefault: true },
      { currencyCode: 'usd', isDefault: false },
    ])
  })

  test('adding to a store that already has a default does not move it', async ({ expect, factories }) => {
    await createStoreWithCurrencies(factories)

    const { body } = await addCurrencies({ currencyCodes: ['eur'] })

    expect(body.store.currencies.filter((currency) => currency.isDefault)).toEqual([
      { currencyCode: 'usd', isDefault: true },
    ])
  })

  test('a code the store already trades in is ignored rather than refused', async ({ expect, factories }) => {
    // A duplicate means two tabs or a double click. The unique index would answer it with a
    // duplicate-key error, which reports the merchant's own success back to them as a failure.
    await createStoreWithCurrencies(factories)

    const { status, body } = await addCurrencies({ currencyCodes: ['usd', 'eur'] })

    expect(status).toBe(200)
    expect(currencyCodes(body.store.currencies)).toEqual(['usd', 'cop', 'eur'])
  })

  test('refuses a code that is not three letters, which is what Intl refuses to name', async ({
    expect,
    factories,
  }) => {
    // The label every currency row renders comes from `Intl.DisplayNames`, and a malformed code
    // is a `RangeError` there rather than a missing name. This list is where a code enters.
    await createStoreWithCurrencies(factories)

    const { status } = await api.post<ApiErrorBody>('/admin/store/currencies', { currencyCodes: ['12'] })

    expect(status).toBe(400)
    expect(currencyCodes((await getStore()).body.store.currencies)).toEqual(['usd', 'cop'])
  })
})

test.describe('POST /admin/store/currencies/:code/default', () => {
  test('moves the default, and leaves exactly one', async ({ expect, factories }) => {
    await createStoreWithCurrencies(factories)

    const { status, body } = await makeDefault('cop')

    expect(status).toBe(200)
    // The default leads the list, which is the order the price editor draws its columns in.
    expect(body.store.currencies).toEqual([
      { currencyCode: 'cop', isDefault: true },
      { currencyCode: 'usd', isDefault: false },
    ])
    expect((await getStore()).body.store.currencies.filter((currency) => currency.isDefault)).toHaveLength(1)
  })

  test('nominating the currency that is already the default leaves it alone', async ({ expect, factories }) => {
    await createStoreWithCurrencies(factories)

    const { status, body } = await makeDefault('usd')

    expect(status).toBe(200)
    expect(body.store.currencies.filter((currency) => currency.isDefault)).toEqual([
      { currencyCode: 'usd', isDefault: true },
    ])
  })

  test('leaves one default even when the store somehow starts with several', async ({ expect, factories }) => {
    // Nothing in this API can produce two defaults, but a seed or a migration can, and this route
    // is the only thing that repairs it. The demotion and the promotion share one transaction.
    const store = await factories.create.store({ name: 'Proteus' })
    await factories.create.storeCurrency({ storeId: store.id, currencyCode: 'usd', isDefault: true })
    await factories.create.storeCurrency({ storeId: store.id, currencyCode: 'cop', isDefault: true })

    const { body } = await makeDefault('cop')

    expect(body.store.currencies).toEqual([
      { currencyCode: 'cop', isDefault: true },
      { currencyCode: 'usd', isDefault: false },
    ])
  })

  test('a currency the store does not trade in is a 404', async ({ expect, factories }) => {
    await createStoreWithCurrencies(factories)

    const { status, body } = await api.post<ApiErrorBody>('/admin/store/currencies/eur/default')

    expect(status).toBe(404)
    expect(body.message).toContain('eur')
  })
})

test.describe('DELETE /admin/store/currencies/:code', () => {
  test('stops the store trading in a currency', async ({ expect, factories }) => {
    await createStoreWithCurrencies(factories)

    const { status, body } = await removeCurrency('cop')

    expect(status).toBe(200)
    expect(body.deleted).toBe(true)
    expect(currencyCodes((await getStore()).body.store.currencies)).toEqual(['usd'])
  })

  test('the removal is soft, so the code can be added again', async ({ expect, factories }) => {
    // The unique index only covers live rows. A merchant who removes a market and reopens it must
    // not meet a duplicate-key error from the row they deleted.
    await createStoreWithCurrencies(factories)

    await removeCurrency('cop')
    const { status, body } = await addCurrencies({ currencyCodes: ['cop'] })

    expect(status).toBe(200)
    expect(currencyCodes(body.store.currencies)).toEqual(['usd', 'cop'])
  })

  test('refuses to remove the default currency', async ({ expect, factories }) => {
    // It is the row the Store card names and the column the price editor leads with. Removing it
    // leaves all of them reading an absent row, and nothing else in this feature would report it.
    await createStoreWithCurrencies(factories)

    const { status, body } = await api.delete<ApiErrorBody>('/admin/store/currencies/usd')

    expect(status).toBe(400)
    expect(body.type).toBe(ErrorTypes.NOT_ALLOWED)
    expect(body.message).toContain('default currency')
    expect(currencyCodes((await getStore()).body.store.currencies)).toEqual(['usd', 'cop'])
  })

  test('refuses to remove a currency a region settles in, naming the region', async ({ expect, factories }) => {
    // The rule that a region's currency is one of the store's is enforced when the region is
    // written and never re-checked, so this route is the one place a live region can be stranded
    // in money the store no longer holds — still taking carts, still pricing nothing.
    await createStoreWithCurrencies(factories)
    await factories.create.region({ name: 'Colombia', currencyCode: 'cop' })

    const { status, body } = await api.delete<ApiErrorBody>('/admin/store/currencies/cop')

    expect(status).toBe(400)
    expect(body.type).toBe(ErrorTypes.NOT_ALLOWED)
    expect(body.message).toContain('Colombia')
    expect(currencyCodes((await getStore()).body.store.currencies)).toEqual(['usd', 'cop'])
  })

  test('a currency the store does not trade in is a 404', async ({ expect, factories }) => {
    await createStoreWithCurrencies(factories)

    const { status } = await api.delete<ApiErrorBody>('/admin/store/currencies/eur')

    expect(status).toBe(404)
  })
})

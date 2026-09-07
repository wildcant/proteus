import type { ApiErrorBody, TestApi } from '@tests/setup/create-api.js'
import { type Fixtures, test } from '@tests/setup/test-extend.js'
import { authHeader } from '@tests/utils/auth-header.js'
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

test.describe('GET /admin/store', () => {
  test('returns the store with every currency it sells in', async ({ expect, factories }) => {
    const store = await createStoreWithCurrencies(factories)

    const { status, body } = await api.get<typeof storeRoutes.GetOutput>('/admin/store')

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

    const { body } = await api.get<typeof storeRoutes.GetOutput>('/admin/store')

    expect(body.store).toMatchObject({ id: store.id, defaultRegionId: region.id })
  })

  test('a store with no currencies configured yet answers with an empty list', async ({ expect, factories }) => {
    // Not an error: the store exists, it simply prices nothing yet. The price forms render no
    // currency column rather than falling back to one nobody chose.
    await factories.create.store()

    const { status, body } = await api.get<typeof storeRoutes.GetOutput>('/admin/store')

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

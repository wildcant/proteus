import { BigNumber } from '@core/bignumber.js'
import type { ApiErrorBody, TestApi, TestResponse } from '@tests/setup/create-api.js'
import { type Fixtures, test } from '@tests/setup/test-extend.js'
import cartDefinitions from '../carts/definitions.js'
import type * as cartRoutes from '../carts/route.js'
import type * as productByIdRoutes from '../products/[id]/route.js'
import productDefinitions from '../products/definitions.js'
import type * as productRoutes from '../products/route.js'

type Factories = Fixtures['factories']
type Services = Fixtures['service']
type ProductBody = TestResponse<typeof productByIdRoutes.GetOutput>['body']

let api: TestApi

/**
 * Both scopes on one server, because the chain is a property of the store API rather than of
 * either resource: the same country segment has to price a product listing and open a cart in the
 * same money.
 */
test.beforeEach(async ({ createApi }) => {
  api = await createApi({ definitions: [...productDefinitions, ...cartDefinitions] })
})

/**
 * Two markets, with the United States as the store's default — so a response quoted in pesos can
 * only have come from a signal the request carried, never from the fallback.
 */
const createMarkets = async (factories: Factories, options: { storeDefault?: 'us' | 'none' } = {}) => {
  const unitedStates = await factories.create.region({ name: 'United States', currencyCode: 'usd' })
  const colombia = await factories.create.region({ name: 'Colombia', currencyCode: 'cop' })
  await factories.create.country({ id: 'us', regionId: unitedStates.id, localeCode: 'en-US' })
  await factories.create.country({ id: 'co', regionId: colombia.id, localeCode: 'es-CO' })
  // In the ISO table and owned by no region, so naming it is a request the store can parse and
  // still has no currency to answer with.
  await factories.create.country({ id: 'qq' })

  const store = await factories.create.store({
    defaultRegionId: options.storeDefault === 'none' ? null : unitedStates.id,
  })

  return { unitedStates, colombia, store }
}

/** One published variant carrying a price in each market's currency. */
const createVariantPricedInBothMarkets = async (service: Services) => {
  const { product } = await service.create.product(api.container, { status: 'published' })
  const variant = await service.create.productVariant(api.container, product.id)
  await service.create.variantPrices(api.container, [variant.id], {
    prices: [
      { currencyCode: 'usd', amount: new BigNumber(90) },
      { currencyCode: 'cop', amount: new BigNumber(360000) },
    ],
  })

  return { product, variant }
}

const priceOf = (body: ProductBody) => body.product.variants[0]?.calculatedPrice

test.describe('currency from the country on the request', () => {
  test('prices a product in the currency of the region that sells to the country', async ({
    expect,
    factories,
    service,
  }) => {
    await createMarkets(factories)
    const { product } = await createVariantPricedInBothMarkets(service)

    const colombian = await api.get<typeof productByIdRoutes.GetOutput>(`/store/products/${product.id}`, undefined, {
      query: { countryCode: 'co' },
    })
    const american = await api.get<typeof productByIdRoutes.GetOutput>(`/store/products/${product.id}`, undefined, {
      query: { countryCode: 'us' },
    })

    expect(priceOf(colombian.body)).toMatchObject({ currencyCode: 'cop', calculatedAmount: '360000' })
    expect(priceOf(american.body)).toMatchObject({ currencyCode: 'usd', calculatedAmount: '90' })
  })

  test('prices a product listing the same way it prices one product', async ({ expect, factories, service }) => {
    await createMarkets(factories)
    await createVariantPricedInBothMarkets(service)

    const { status, body } = await api.get<typeof productRoutes.GetOutput>('/store/products', undefined, {
      query: { countryCode: 'co' },
    })

    expect(status).toBe(200)
    expect(body.products[0]?.startingPrice).toMatchObject({ currencyCode: 'cop', calculatedAmount: '360000' })
  })

  test('reads the country code case-insensitively, as a URL segment may carry it', async ({
    expect,
    factories,
    service,
  }) => {
    await createMarkets(factories)
    const { product } = await createVariantPricedInBothMarkets(service)

    const { body } = await api.get<typeof productByIdRoutes.GetOutput>(`/store/products/${product.id}`, undefined, {
      query: { countryCode: 'CO' },
    })

    expect(priceOf(body)?.currencyCode).toBe('cop')
  })

  test('refuses a country no region sells to rather than falling back to the default', async ({
    expect,
    factories,
    service,
  }) => {
    await createMarkets(factories)
    const { product } = await createVariantPricedInBothMarkets(service)

    const { status, body } = await api.get<ApiErrorBody>(`/store/products/${product.id}`, undefined, {
      query: { countryCode: 'qq' },
    })

    expect(status).toBe(400)
    expect(body.message).toContain('qq')
  })

  test('refuses a country code that is not in the ISO table', async ({ expect, factories, service }) => {
    await createMarkets(factories)
    const { product } = await createVariantPricedInBothMarkets(service)

    const { status } = await api.get<ApiErrorBody>(`/store/products/${product.id}`, undefined, {
      query: { countryCode: 'zz' },
    })

    expect(status).toBe(400)
  })
})

test.describe('currency from the cart on the request', () => {
  test("prices a product in the cart's currency when no country code is given", async ({
    expect,
    factories,
    service,
  }) => {
    await createMarkets(factories)
    const { product } = await createVariantPricedInBothMarkets(service)
    const created = await api.post<typeof cartRoutes.PostOutput>('/store/carts', {}, { query: { countryCode: 'co' } })

    const { body } = await api.get<typeof productByIdRoutes.GetOutput>(`/store/products/${product.id}`, undefined, {
      query: { cartId: created.body.cart.id },
    })

    expect(priceOf(body)?.currencyCode).toBe('cop')
  })

  test('lets the country code override the cart, so switching market reprices immediately', async ({
    expect,
    factories,
    service,
  }) => {
    await createMarkets(factories)
    const { product } = await createVariantPricedInBothMarkets(service)
    const created = await api.post<typeof cartRoutes.PostOutput>('/store/carts', {}, { query: { countryCode: 'co' } })

    const { body } = await api.get<typeof productByIdRoutes.GetOutput>(`/store/products/${product.id}`, undefined, {
      query: { countryCode: 'us', cartId: created.body.cart.id },
    })

    expect(priceOf(body)?.currencyCode).toBe('usd')
  })

  test('falls through to the default for a cart id that names nothing', async ({ expect, factories, service }) => {
    await createMarkets(factories)
    const { product } = await createVariantPricedInBothMarkets(service)

    const { status, body } = await api.get<typeof productByIdRoutes.GetOutput>(
      `/store/products/${product.id}`,
      undefined,
      { query: { cartId: 'cart_gonebeforetheshoppercameback' } },
    )

    expect(status).toBe(200)
    expect(priceOf(body)?.currencyCode).toBe('usd')
  })
})

test.describe("currency from the store's default region", () => {
  test('prices a product in the default region currency when the request carries no signal', async ({
    expect,
    factories,
    service,
  }) => {
    await createMarkets(factories)
    const { product } = await createVariantPricedInBothMarkets(service)

    const { status, body } = await api.get<typeof productByIdRoutes.GetOutput>(`/store/products/${product.id}`)

    expect(status).toBe(200)
    expect(priceOf(body)).toMatchObject({ currencyCode: 'usd', calculatedAmount: '90' })
  })

  test('refuses to price anything when the store has no default region either', async ({
    expect,
    factories,
    service,
  }) => {
    await createMarkets(factories, { storeDefault: 'none' })
    const { product } = await createVariantPricedInBothMarkets(service)

    const { status, body } = await api.get<ApiErrorBody>(`/store/products/${product.id}`)

    expect(status).toBe(500)
    expect(body.message).toContain('default region')
  })
})

test.describe('POST /store/carts', () => {
  test('records the region of the market it was opened in, and that region currency', async ({ expect, factories }) => {
    const { colombia } = await createMarkets(factories)

    const { status, body } = await api.post<typeof cartRoutes.PostOutput>(
      '/store/carts',
      {},
      { query: { countryCode: 'co' } },
    )

    expect(status).toBe(201)
    expect(body.cart).toMatchObject({ regionId: colombia.id, currencyCode: 'cop' })
  })

  test("records the store's default region when the request names no market", async ({ expect, factories }) => {
    const { unitedStates } = await createMarkets(factories)

    const { body } = await api.post<typeof cartRoutes.PostOutput>('/store/carts', {})

    expect(body.cart).toMatchObject({ regionId: unitedStates.id, currencyCode: 'usd' })
  })

  test('refuses a variant with no price in the resolved currency instead of pricing it at zero', async ({
    expect,
    factories,
    service,
  }) => {
    await createMarkets(factories)
    const { variant } = await service.create.sellableVariant(api.container, { price: { currencyCode: 'usd' } })

    const { status, body } = await api.post<ApiErrorBody>(
      '/store/carts',
      { items: [{ variantId: variant.id, quantity: 1 }] },
      { query: { countryCode: 'co' } },
    )

    expect(status).toBe(400)
    expect(body.message).toContain('no price in cop')
  })
})

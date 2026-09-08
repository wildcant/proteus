import type { ApiErrorBody, TestApi } from '@tests/setup/create-api.js'
import { type Fixtures, test } from '@tests/setup/test-extend.js'
import cartDefinitions from '../../../definitions.js'
import type * as shippingOptionRoutes from '../route.js'

type Factories = Fixtures['factories']
type Service = Fixtures['service']

let api: TestApi

test.beforeEach(async ({ createApi }) => {
  api = await createApi({
    definitions: cartDefinitions,
    matchers: ['/store/carts/:id/shipping-options'],
  })
})

const listOptions = (cartId: string) =>
  api.get<typeof shippingOptionRoutes.GetOutput>(`/store/carts/${cartId}/shipping-options`)

/** A market: a region, the country it sells to, and one shipping option zoned to that country. */
const createMarket = async (factories: Factories, iso2: string, currencyCode: string) => {
  const region = await factories.create.region({ name: iso2.toUpperCase(), currencyCode })
  const country = await factories.create.country({ id: iso2, regionId: region.id })
  const shippingOption = await factories.create.shippingOptionWithZone({
    geoZone: { countryCode: iso2 },
    shippingOption: { name: `${iso2.toUpperCase()} Standard` },
  })

  return { region, country, shippingOption }
}

/** Both markets, so every assertion below reads against a list that could have carried the other. */
const createMarkets = async (factories: Factories) => ({
  us: await createMarket(factories, 'us', 'usd'),
  co: await createMarket(factories, 'co', 'cop'),
})

const cartShippingTo = async (
  service: Service,
  { regionId, currencyCode, countryCode }: { regionId: string; currencyCode: string; countryCode?: string },
) => {
  const cart = await service.create.cart(api.container, { regionId, currencyCode })
  if (countryCode) {
    await service.create.cartAddresses(api.container, cart.id, {
      shippingAddress: { countryCode, city: 'Anywhere', province: 'Anywhere', postalCode: '00000' },
      billingAddress: undefined,
    })
  }
  return cart
}

test.describe('GET /store/carts/:id/shipping-options', () => {
  test("offers the options zoned to the cart's shipping address country", async ({ service, factories, expect }) => {
    const markets = await createMarkets(factories)
    const cart = await cartShippingTo(service, {
      regionId: markets.co.region.id,
      currencyCode: 'cop',
      countryCode: 'co',
    })

    const { status, body } = await listOptions(cart.id)

    expect(status).toBe(200)
    expect(body.shippingOptions.map((option) => option.id)).toEqual([markets.co.shippingOption.id])
  })

  test('offers the US options to a cart shipping to the US', async ({ service, factories, expect }) => {
    const markets = await createMarkets(factories)
    const cart = await cartShippingTo(service, {
      regionId: markets.us.region.id,
      currencyCode: 'usd',
      countryCode: 'us',
    })

    const { status, body } = await listOptions(cart.id)

    expect(status).toBe(200)
    expect(body.shippingOptions.map((option) => option.id)).toEqual([markets.us.shippingOption.id])
  })

  /**
   * The address wins over the region, which is the whole point of reading it first: a Colombian
   * cart whose shopper types a US address is offered the US rates, not its region's.
   */
  test('prefers the shipping address country over the region', async ({ service, factories, expect }) => {
    const markets = await createMarkets(factories)
    const cart = await cartShippingTo(service, {
      regionId: markets.co.region.id,
      currencyCode: 'cop',
      countryCode: 'us',
    })

    const { body } = await listOptions(cart.id)

    expect(body.shippingOptions.map((option) => option.id)).toEqual([markets.us.shippingOption.id])
  })

  test("falls back to the region's country before an address is entered", async ({ service, factories, expect }) => {
    const markets = await createMarkets(factories)
    const cart = await cartShippingTo(service, { regionId: markets.co.region.id, currencyCode: 'cop' })

    const { status, body } = await listOptions(cart.id)

    expect(status).toBe(200)
    expect(body.shippingOptions.map((option) => option.id)).toEqual([markets.co.shippingOption.id])
  })

  /**
   * The market is real and simply has no rates yet. An empty list says exactly that; the US
   * option in the fixture is what a country fallback would have reached for instead.
   */
  test('returns an empty list when the region sells to a country no option covers', async ({
    service,
    factories,
    expect,
  }) => {
    await createMarkets(factories)
    const region = await factories.create.region({ name: 'Japan', currencyCode: 'jpy' })
    await factories.create.country({ id: 'jp', regionId: region.id })
    const cart = await cartShippingTo(service, { regionId: region.id, currencyCode: 'jpy' })

    const { status, body } = await listOptions(cart.id)

    expect(status).toBe(200)
    expect(body.shippingOptions).toEqual([])
  })

  test('returns 404 for a cart that does not exist', async ({ factories, expect }) => {
    await createMarkets(factories)

    const { status, body } = await api.get<ApiErrorBody>('/store/carts/cart_nonexistent/shipping-options')

    expect(status).toBe(404)
    expect(body).toMatchObject({ type: 'not_found' })
  })
})

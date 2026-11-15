import type { AdminCreateShippingOptionResponse } from '@proteus/http-schemas/admin'
import type {
  StoreCartDetailResponse,
  StoreCreateCartLineItemResponse,
  StoreCreateCartShippingMethodResponse,
  StoreShippingOptionListResponse,
} from '@proteus/http-schemas/store'
import type { ApiErrorBody, TestApi } from '@tests/setup/create-api.js'
import { type Fixtures, test } from '@tests/setup/test-extend.js'
import { sql } from 'drizzle-orm'
import shippingOptionDefinitions from '../../../src/api/admin/shipping-options/definitions.js'
import cartDefinitions from '../../../src/api/store/carts/definitions.js'
import { syncFulfillmentProviders } from '../../../src/modules/fulfillment/sync-providers.js'
import { FixtureModules } from '../fixture/keys.js'
import { extensionRegistry as fixtureRegistry } from '../registry.gen.js'

const CITY_RATES_PROVIDER = 'fp_fixture_city_rates_default'
const COP_PRICE = '100000'

let api: TestApi

test.beforeEach(async ({ createApi }) => {
  api = await createApi({ definitions: [...cartDefinitions, ...shippingOptionDefinitions] })
})

/**
 * A Colombian market with two options: the fixture courier's calculated one, zoned to the whole
 * country and priced from its rate table, and a flat one zoned to Medellín alone.
 */
const createMarket = async ({ factories, service }: Pick<Fixtures, 'factories' | 'service'>) => {
  const region = await factories.create.region({ name: 'Colombia', currencyCode: 'cop' })
  await factories.create.country({ id: 'co', regionId: region.id })

  const courier = await factories.create.shippingOptionWithZone({
    geoZone: { type: 'country', countryCode: 'co' },
    shippingOption: { name: 'Courier', priceType: 'calculated', amount: null, providerId: CITY_RATES_PROVIDER },
  })
  const medellinPickup = await factories.create.shippingOptionWithZone({
    geoZone: { type: 'city', countryCode: 'co', provinceCode: 'Antioquia', city: 'Medellín' },
    shippingOption: { name: 'Medellín pickup', amount: 7000 },
  })

  // The rate table lives in the fixture extension's own module, which only its provider reads.
  await api.container
    .resolve(FixtureModules.SHIPPING_RATES)
    .createShippingRates([{ city: 'Bogotá', baseAmount: 8000, perItemAmount: 2000, deliveryDays: 2 }])

  const product = await factories.create.productWithPricing({ price: { amount: COP_PRICE, currencyCode: 'cop' } })
  const otherProduct = await factories.create.productWithPricing({ price: { amount: COP_PRICE, currencyCode: 'cop' } })
  const cart = await service.create.cart(api.container, { regionId: region.id, currencyCode: 'cop' })

  return { cart, courier, medellinPickup, product, otherProduct }
}

/**
 * The calculated-shipping journey through the fixture extension's provider: the options a city is
 * offered, the method stored at the provider's price with its data, and the price following the
 * cart's items and address.
 */
test('a calculated option is quoted, stored and re-priced from the fixture courier’s rate table', async ({
  factories,
  service,
  http,
  expect,
}) => {
  const { cart, courier, medellinPickup, product, otherProduct } = await createMarket({ factories, service })
  const shipTo = (city: string, province: string) =>
    api.post(`/store/carts/${cart.id}`, {
      shippingAddress: http.store.cartAddress({ countryCode: 'CO', city, province }),
    })
  const listOptions = async () => {
    const { body } = await api.get<StoreShippingOptionListResponse>(`/store/carts/${cart.id}/shipping-options`)
    return body.shippingOptions.map(({ name, priceType, amount }) => ({ name, priceType, amount }))
  }
  const readCart = async () => (await api.get<StoreCartDetailResponse>(`/store/carts/${cart.id}`)).body.cart

  const added = await api.post<StoreCreateCartLineItemResponse>(`/store/carts/${cart.id}/line-items`, {
    variantId: product.variant.id,
    quantity: 1,
  })
  expect(added.status).toBe(201)

  // Bogotá, typed with stray space and casing: the courier quotes its base plus one unit, and the
  // Medellín option is not offered outside Medellín.
  await shipTo(' bogotá ', 'Cundinamarca')
  expect(await listOptions()).toEqual([{ name: 'Courier', priceType: 'calculated', amount: 10000 }])

  // A city the rate table does not list: the courier cannot price it, so nothing is offered.
  await shipTo('Leticia', 'Amazonas')
  expect(await listOptions()).toEqual([])

  // Medellín: its city zone serves it, while the courier, with no rate there, still cannot.
  await shipTo('medellín', ' antioquia')
  expect(await listOptions()).toEqual([{ name: 'Medellín pickup', priceType: 'flat', amount: 7000 }])

  await shipTo('Bogotá', 'Cundinamarca')
  const chosen = await api.post<StoreCreateCartShippingMethodResponse>(`/store/carts/${cart.id}/shipping-methods`, {
    shippingOptionId: courier.id,
  })
  expect(chosen.status).toBe(201)
  expect(chosen.body.shippingMethod).toMatchObject({
    name: 'Courier',
    amount: '10000',
    shippingOptionId: courier.id,
    data: { deliveryDays: 2 },
  })

  // An option that does not serve the address is refused, and the choice already made survives.
  const refused = await api.post<ApiErrorBody>(`/store/carts/${cart.id}/shipping-methods`, {
    shippingOptionId: medellinPickup.id,
  })
  expect(refused.status).toBe(400)
  expect(refused.body).toMatchObject({ type: 'not_allowed', code: 'fulfillment_option_unavailable' })

  // Three units: the courier's quote follows the quantity, and so does the cart total.
  await api.post(`/store/carts/${cart.id}/line-items/${added.body.lineItem.id}`, { quantity: 3 })
  const afterQuantity = await readCart()
  expect(afterQuantity.shippingMethods.map(({ name, amount }) => ({ name, amount }))).toEqual([
    { name: 'Courier', amount: '14000' },
  ])
  expect(afterQuantity.totals).toMatchObject({ shippingTotal: '14000', cartTotal: '314000' })

  // Another line, then removing it: the quote rises with it and falls back when it goes.
  const other = await api.post<StoreCreateCartLineItemResponse>(`/store/carts/${cart.id}/line-items`, {
    variantId: otherProduct.variant.id,
    quantity: 1,
  })
  expect((await readCart()).totals).toMatchObject({ shippingTotal: '16000' })
  await api.delete(`/store/carts/${cart.id}/line-items/${other.body.lineItem.id}`)
  expect((await readCart()).totals).toMatchObject({ shippingTotal: '14000' })

  // Moving the address to a city the courier does not reach drops the method rather than keeping
  // a price nobody quotes.
  await shipTo('Leticia', 'Amazonas')
  const afterMove = await readCart()
  expect(afterMove.shippingMethods).toEqual([])
  expect(afterMove.totals).toMatchObject({ shippingTotal: '0' })
})

test('an extension’s fulfillment provider is registered and synced like core’s', async ({ db, getDb, expect }) => {
  const providerIds = async () =>
    (await db.execute<{ id: string }>(sql`SELECT id FROM fulfillment_provider ORDER BY id`)).map((row) => row.id)

  // The container's loader wrote its row beside the manual provider's.
  expect(await providerIds()).toEqual([CITY_RATES_PROVIDER, 'fp_manual_default'])

  // workerd skips the loader's write, so its rows come from the sync script, which reads the registry.
  await db.execute(sql`DELETE FROM fulfillment_provider`)
  await syncFulfillmentProviders(
    getDb,
    fixtureRegistry.fulfillmentProviders.map((declaration) => declaration.resolve),
  )
  expect(await providerIds()).toEqual([CITY_RATES_PROVIDER, 'fp_manual_default'])
})

test('an admin creates a calculated option only with a provider that calculates', async ({ factories, expect }) => {
  const existing = await factories.create.shippingOptionWithZone({ geoZone: { countryCode: 'co' } })
  const createOption = (providerId: string) =>
    api.post<AdminCreateShippingOptionResponse | ApiErrorBody>('/admin/shipping-options', {
      name: 'Courier',
      priceType: 'calculated',
      serviceZoneId: existing.serviceZone.id,
      shippingProfileId: existing.shippingProfile.id,
      providerId,
    })

  const created = await createOption(CITY_RATES_PROVIDER)
  expect(created.status).toBe(201)
  expect(created.body).toMatchObject({ shippingOption: { priceType: 'calculated', providerId: CITY_RATES_PROVIDER } })

  // The manual provider prices nothing, so an option it would never be able to quote is refused.
  const refused = await createOption('fp_manual_default')
  expect(refused.status).toBe(400)
  expect(refused.body).toMatchObject({ type: 'invalid_data', code: 'fulfillment_cannot_calculate' })
})

import type { ApiErrorBody, TestApi } from '@tests/setup/create-api.js'
import { type Fixtures, test } from '@tests/setup/test-extend.js'
import cartDefinitions from '../../../definitions.js'
import type * as shippingMethodRoutes from '../route.js'

type Factories = Fixtures['factories']
type Service = Fixtures['service']

let api: TestApi

test.beforeEach(async ({ createApi }) => {
  api = await createApi({
    definitions: cartDefinitions,
    matchers: ['/store/carts/:id/shipping-methods'],
  })
})

const chooseOption = (cartId: string, shippingOptionId: string) =>
  api.post<typeof shippingMethodRoutes.PostOutput>(`/store/carts/${cartId}/shipping-methods`, {
    shippingOptionId,
  })

const cartFor = async (service: Service, factories: Factories) => {
  const region = await factories.create.region({ name: 'US', currencyCode: 'usd' })
  await factories.create.country({ id: 'us', regionId: region.id })

  return service.create.cart(api.container, { regionId: region.id, currencyCode: 'usd' })
}

test.describe('POST /store/carts/:id/shipping-methods', () => {
  test("writes the method from the option, not from the shopper's request", async ({ service, factories, expect }) => {
    const cart = await cartFor(service, factories)
    const shipping = await factories.create.shippingOptionWithZone({
      geoZone: { countryCode: 'us' },
      shippingOption: { name: 'Overnight', amount: 1500 },
    })

    const { status, body } = await chooseOption(cart.id, shipping.id)

    expect(status).toBe(201)
    // The request carried an id and nothing else: the name and the price are the option's.
    expect(body.shippingMethod).toMatchObject({ name: 'Overnight', shippingOptionId: shipping.id })
    expect(body.shippingMethod.amount).toBe('1500')
  })

  /**
   * The reason the route delegates to `setShippingMethod` rather than adding: the delivery step
   * offers one choice, so a shopper changing their mind must not end up paying two deliveries.
   */
  test('replaces the previous choice rather than adding a second delivery', async ({ service, factories, expect }) => {
    const cart = await cartFor(service, factories)
    const standard = await factories.create.shippingOptionWithZone({
      geoZone: { countryCode: 'us' },
      shippingOption: { name: 'Standard', amount: 500 },
    })
    const overnight = await factories.create.shippingOptionWithZone({
      geoZone: { countryCode: 'us' },
      shippingOption: { name: 'Overnight', amount: 1500 },
    })

    await chooseOption(cart.id, standard.id)
    const { status } = await chooseOption(cart.id, overnight.id)

    expect(status).toBe(201)

    const methods = await service.read.cartShippingMethods(api.container, { cartId: cart.id })
    expect(methods.map((method) => method.name)).toEqual(['Overnight'])
  })

  test('refuses a disabled option and leaves the cart as it was', async ({ service, factories, expect }) => {
    const cart = await cartFor(service, factories)
    const standard = await factories.create.shippingOptionWithZone({
      geoZone: { countryCode: 'us' },
      shippingOption: { name: 'Standard', amount: 500 },
    })
    const withdrawn = await factories.create.shippingOptionWithZone({
      geoZone: { countryCode: 'us' },
      shippingOption: { name: 'Withdrawn', amount: 900, isEnabled: false },
    })

    await chooseOption(cart.id, standard.id)
    const { status, body } = await api.post<ApiErrorBody>(`/store/carts/${cart.id}/shipping-methods`, {
      shippingOptionId: withdrawn.id,
    })

    expect(status).toBe(400)
    expect(body).toMatchObject({ type: 'not_allowed' })

    // The refusal happens before the replacement, so the choice already made survives it.
    const methods = await service.read.cartShippingMethods(api.container, { cartId: cart.id })
    expect(methods.map((method) => method.name)).toEqual(['Standard'])
  })
})

import type { ApiErrorBody, TestApi } from '@tests/setup/create-api.js'
import { type Fixtures, test } from '@tests/setup/test-extend.js'
import { vi } from 'vitest'
import { env } from '../../../../env.js'
import type * as paymentProviderRoutes from '../[id]/payment-providers/route.js'
import cartDefinitions from '../definitions.js'

type Factories = Fixtures['factories']
type Services = Fixtures['service']
type Region = Awaited<ReturnType<Factories['create']['region']>>

/**
 * The two providers the payment module's loader registers and seeds when the container boots.
 * A test cannot add a third — the loader owns the module's private container, and an unregistered
 * id has no label or test-only flag to report — so these are what a region gets to offer.
 */
const MANUAL_PROVIDER_ID = 'pp_system_default'
const STRIPE_PROVIDER_ID = 'pp_stripe_default'

let api: TestApi

test.beforeEach(async ({ createApi }) => {
  api = await createApi({ definitions: cartDefinitions })
})

/** Two markets, so every assertion below is about one of them rather than about "the region". */
const createMarkets = async (factories: Factories) => ({
  unitedStates: await factories.create.region({ name: 'United States', currencyCode: 'usd' }),
  colombia: await factories.create.region({ name: 'Colombia', currencyCode: 'cop' }),
})

const offer = (factories: Factories, region: Region, paymentProviderId: string) =>
  factories.create.regionPaymentProvider({ regionId: region.id, paymentProviderId })

const cartIn = (service: Services, region: Region) =>
  service.create.cart(api.container, { regionId: region.id, currencyCode: region.currencyCode })

const providersFor = (cartId: string) =>
  api.get<typeof paymentProviderRoutes.GetOutput>(`/store/carts/${cartId}/payment-providers`)

const providerIdsFor = async (cartId: string) => (await providersFor(cartId)).body.paymentProviders.map(({ id }) => id)

/**
 * What a shopper is offered at checkout is the region's list, not the deployment's. The cart is
 * what names the region: it is where checkout already read the currency from, so a provider the
 * cart's market does not carry can never be one the shopper is shown and then billed through.
 */
test.describe('GET /store/carts/:id/payment-providers', () => {
  test('offers exactly what the cart’s market carries, not every enabled provider', async ({
    expect,
    factories,
    service,
  }) => {
    const { unitedStates } = await createMarkets(factories)
    await offer(factories, unitedStates, STRIPE_PROVIDER_ID)
    // Enabled and registered, but linked to no region — so its absence is the region filter working
    // rather than the provider being unavailable.
    const cart = await cartIn(service, unitedStates)

    const { status, body } = await providersFor(cart.id)

    expect(status).toBe(200)
    expect(body.paymentProviders).toEqual([
      { id: STRIPE_PROVIDER_ID, isEnabled: true, label: 'Stripe', isTestOnly: false },
    ])
  })

  test('does not offer a provider only another market carries', async ({ expect, factories, service }) => {
    const { unitedStates, colombia } = await createMarkets(factories)
    await offer(factories, unitedStates, STRIPE_PROVIDER_ID)
    await offer(factories, colombia, MANUAL_PROVIDER_ID)
    const cart = await cartIn(service, colombia)

    expect(await providerIdsFor(cart.id)).toEqual([MANUAL_PROVIDER_ID])
  })

  test('offers a provider both markets carry to both of them', async ({ expect, factories, service }) => {
    const { unitedStates, colombia } = await createMarkets(factories)
    await offer(factories, unitedStates, MANUAL_PROVIDER_ID)
    await offer(factories, colombia, MANUAL_PROVIDER_ID)
    await offer(factories, unitedStates, STRIPE_PROVIDER_ID)

    const american = await cartIn(service, unitedStates)
    const colombian = await cartIn(service, colombia)

    expect(await providerIdsFor(american.id)).toEqual(expect.arrayContaining([MANUAL_PROVIDER_ID, STRIPE_PROVIDER_ID]))
    expect(await providerIdsFor(colombian.id)).toEqual([MANUAL_PROVIDER_ID])
  })

  test('leaves a disabled provider out of every market that carries it', async ({ expect, factories, service }) => {
    const { unitedStates, colombia } = await createMarkets(factories)
    for (const region of [unitedStates, colombia]) {
      await offer(factories, region, MANUAL_PROVIDER_ID)
      await offer(factories, region, STRIPE_PROVIDER_ID)
    }
    await factories.update.paymentProviderEnabled(STRIPE_PROVIDER_ID, false)

    const american = await cartIn(service, unitedStates)
    const colombian = await cartIn(service, colombia)

    expect(await providerIdsFor(american.id)).toEqual([MANUAL_PROVIDER_ID])
    expect(await providerIdsFor(colombian.id)).toEqual([MANUAL_PROVIDER_ID])
  })

  /**
   * Scoping to the region replaced the list the test-only filter used to run over, so this is the
   * one that says the filter survived the move. Manual payment is test-only; Stripe is not.
   */
  test('still hides a test-only provider in production', async ({ expect, factories, service }) => {
    const { unitedStates } = await createMarkets(factories)
    await offer(factories, unitedStates, MANUAL_PROVIDER_ID)
    await offer(factories, unitedStates, STRIPE_PROVIDER_ID)
    const cart = await cartIn(service, unitedStates)

    expect(await providerIdsFor(cart.id)).toEqual(expect.arrayContaining([MANUAL_PROVIDER_ID, STRIPE_PROVIDER_ID]))

    vi.spyOn(env, 'NODE_ENV', 'get').mockReturnValue('production')

    expect(await providerIdsFor(cart.id)).toEqual([STRIPE_PROVIDER_ID])
  })

  /**
   * The cart id comes off a cookie that outlives the cart it names, so an unknown one is ordinary
   * traffic. It has to be an error: answering it with the unscoped list is the leak this route
   * closes, and the shopper would be offered a method their market cannot settle.
   */
  test('fails with a not found for a cart that does not exist, rather than listing every provider', async ({
    expect,
    factories,
  }) => {
    const { unitedStates } = await createMarkets(factories)
    await offer(factories, unitedStates, STRIPE_PROVIDER_ID)

    const { status, body } = await api.get<ApiErrorBody>('/store/carts/cart_missing/payment-providers')

    expect(status).toBe(404)
    expect(body).not.toHaveProperty('paymentProviders')
  })

  /**
   * A cart with no region is in no market, and a market is the only thing that says which methods
   * apply — so the answer is none. Falling back to every provider would reopen the leak on exactly
   * the carts that predate the region being stamped on them.
   */
  test('offers nothing for a cart that belongs to no market', async ({ expect, factories, service }) => {
    const { unitedStates } = await createMarkets(factories)
    await offer(factories, unitedStates, STRIPE_PROVIDER_ID)
    const cart = await service.create.cart(api.container, { regionId: null, currencyCode: 'usd' })

    const { status, body } = await providersFor(cart.id)

    expect(status).toBe(200)
    expect(body.paymentProviders).toEqual([])
  })
})

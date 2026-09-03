import type { StoreCompleteCartResponse, StoreCreatePaymentSessionResponse } from '@proteus/http-schemas/store'
import { stripeGateway } from '@tests/mocks/stripe.js'
import type { ApiErrorBody, TestApi } from '@tests/setup/create-api.js'
import type { Fixtures } from '@tests/setup/test-extend.js'
import { test } from '@tests/setup/test-extend.js'
import { assertDefined } from '@tests/utils/assert-defined.js'
import { authHeader } from '@tests/utils/auth-header.js'
import { vi } from 'vitest'
import cartDefinitions from '../../carts/definitions.js'
import paymentMethodDefinitions from '../../payment-methods/definitions.js'
import paymentCollectionDefinitions from '../definitions.js'

vi.mock('stripe', async () => (await import('@tests/mocks/stripe.js')).stripeModuleMock())

/**
 * What consent does, and what a guest leaves behind.
 *
 * All of it asserted against the faked gateway rather than against our own rows: whether a card
 * is saved, and whether it can ever be shown again, are facts about what Stripe was asked — and
 * the failure this file exists to catch is a card that is attached to a customer and invisible
 * to every selector.
 */

const STRIPE_PROVIDER = 'pp_stripe_default'

let api: TestApi

test.beforeEach(async ({ createApi }) => {
  stripeGateway.reset()
  // Where a card checkout stands once the browser has confirmed: Stripe already has the money,
  // so completing the cart both creates the Payment and captures it.
  stripeGateway.statusOnCreate = 'succeeded'
  api = await createApi({
    definitions: [...cartDefinitions, ...paymentCollectionDefinitions, ...paymentMethodDefinitions],
    namespaceAuth: true,
  })
})

const openSession = (collectionId: string, data: object, headers?: Record<string, string>) =>
  api.post<StoreCreatePaymentSessionResponse | ApiErrorBody>(
    `/store/payment-collections/${collectionId}/payment-sessions`,
    { providerId: STRIPE_PROVIDER, ...data },
    { headers },
  )

const completeCart = (cartId: string, headers?: Record<string, string>) =>
  api.post<StoreCompleteCartResponse>(`/store/carts/${cartId}/complete`, undefined, { headers })

const listWallet = (headers: Record<string, string>) =>
  api.get<{ paymentMethods: { id: string }[] }>('/store/payment-methods', undefined, { headers })

/**
 * A cart ready to pay for, whose only Stripe session is the one the test opens through the route.
 *
 * The factory's session is left on the system provider deliberately: it is `pending`, so opening
 * the real one supersedes and replaces it, and the cart is then completed against exactly the
 * session under test rather than whichever of two the database happened to return first.
 */
async function payableCart(service: Fixtures['service']) {
  const checkout = await service.create.checkoutReadyCart(api.container, {
    cart: { currencyCode: 'usd' },
    addresses: {},
  })
  assertDefined(checkout.paymentCollection)
  return checkout
}

/** The parameters the intent this checkout opened was created with. */
function lastIntentParams() {
  const calls = stripeGateway.callsTo('paymentIntents.create')
  const call = calls.at(-1)
  if (!call) throw new Error('No PaymentIntent was created at the gateway')
  return call.params
}

test.describe('saving a card as a side effect of paying', () => {
  test('a guest leaves no Customer, no saved method and nothing redisplayable', async ({ service, expect }) => {
    const checkout = await payableCart(service)
    assertDefined(checkout.paymentCollection)

    // A guest asking to save is still a guest: there is nowhere to save it to.
    await openSession(checkout.paymentCollection.id, { data: { savePaymentMethod: true } })
    await completeCart(checkout.cart.id)

    expect(stripeGateway.customers.size).toBe(0)
    expect(stripeGateway.methods.size).toBe(0)
    expect(lastIntentParams()).not.toHaveProperty('setup_future_usage')
    expect(stripeGateway.callsTo('paymentMethods.update')).toHaveLength(0)
  })

  test('consent produces setup_future_usage and a card the wallet can show', async ({ service, expect }) => {
    const customer = await service.create.customer(api.container, { hasAccount: true })
    const headers = authHeader('customer', customer.id)
    const checkout = await payableCart(service)
    assertDefined(checkout.paymentCollection)

    await openSession(checkout.paymentCollection.id, { data: { savePaymentMethod: true } }, headers)
    expect(lastIntentParams()).toMatchObject({
      // biome-ignore lint/style/useNamingConvention: the Stripe SDK parameter
      setup_future_usage: 'on_session',
    })

    await completeCart(checkout.cart.id, headers)

    // `setup_future_usage` attaches the card and leaves `allow_redisplay` unspecified, which the
    // customer-scoped listing filters straight back out. Setting it is its own call.
    expect(stripeGateway.callsTo('paymentMethods.update')).toMatchObject([
      {
        params: {
          // biome-ignore lint/style/useNamingConvention: the Stripe SDK parameter
          allow_redisplay: 'always',
        },
      },
    ])
    expect((await listWallet(headers)).body.paymentMethods).toHaveLength(1)
  })

  test('no consent produces neither, and the wallet stays empty', async ({ service, expect }) => {
    const customer = await service.create.customer(api.container, { hasAccount: true })
    const headers = authHeader('customer', customer.id)
    const checkout = await payableCart(service)
    assertDefined(checkout.paymentCollection)

    await openSession(checkout.paymentCollection.id, { data: { savePaymentMethod: false } }, headers)
    await completeCart(checkout.cart.id, headers)

    expect(lastIntentParams()).not.toHaveProperty('setup_future_usage')
    expect(stripeGateway.callsTo('paymentMethods.update')).toHaveLength(0)
    expect((await listWallet(headers)).body.paymentMethods).toEqual([])
  })

  test('the option is honoured for a shopper whose wallet is empty', async ({ service, expect }) => {
    const customer = await service.create.customer(api.container, { hasAccount: true })
    const headers = authHeader('customer', customer.id)
    const checkout = await payableCart(service)
    assertDefined(checkout.paymentCollection)

    // Nothing saved yet — which is exactly the shopper a `savedMethods.length` gate would refuse
    // to let save their first card.
    expect((await listWallet(headers)).body.paymentMethods).toEqual([])

    await openSession(checkout.paymentCollection.id, { data: { savePaymentMethod: true } }, headers)

    expect(lastIntentParams()).toMatchObject({
      // biome-ignore lint/style/useNamingConvention: the Stripe SDK parameter
      setup_future_usage: 'on_session',
    })
  })

  test('a Customer row that is not an account gets no Stripe Customer', async ({ service, expect }) => {
    const guest = await service.create.customer(api.container, { hasAccount: false })
    const checkout = await payableCart(service)
    assertDefined(checkout.paymentCollection)

    await openSession(
      checkout.paymentCollection.id,
      { data: { savePaymentMethod: true } },
      authHeader('customer', guest.id),
    )

    expect(stripeGateway.customers.size).toBe(0)
    expect(lastIntentParams()).not.toHaveProperty('customer')
  })
})

test.describe('paying with a saved card', () => {
  /** A shopper with an account holder and one stored card, arranged through the real routes. */
  async function shopperWithCard(service: Fixtures['service']) {
    const customer = await service.create.customer(api.container, { hasAccount: true })
    const headers = authHeader('customer', customer.id)
    await listWallet(headers)

    const gatewayCustomer = stripeGateway.customerFor(customer.id)
    if (!gatewayCustomer) throw new Error('No Stripe Customer was created for an authenticated shopper')

    return { customer, headers, gatewayCustomer, method: stripeGateway.storeMethod(gatewayCustomer.id) }
  }

  test('charges the card the shopper chose, against their own account holder', async ({ service, expect }) => {
    const shopper = await shopperWithCard(service)
    const checkout = await payableCart(service)
    assertDefined(checkout.paymentCollection)

    const { status } = await openSession(
      checkout.paymentCollection.id,
      { data: { paymentMethodId: shopper.method.id } },
      shopper.headers,
    )

    expect(status).toBe(201)
    expect(lastIntentParams()).toMatchObject({
      customer: shopper.gatewayCustomer.id,
      // biome-ignore lint/style/useNamingConvention: the Stripe SDK parameter
      payment_method: shopper.method.id,
    })
  })

  test("will not charge another customer's card", async ({ service, expect }) => {
    const victim = await shopperWithCard(service)
    const attacker = await shopperWithCard(service)
    const checkout = await payableCart(service)
    assertDefined(checkout.paymentCollection)
    const intentsBefore = stripeGateway.callsTo('paymentIntents.create').length

    const { status, body } = await openSession(
      checkout.paymentCollection.id,
      { data: { paymentMethodId: victim.method.id } },
      attacker.headers,
    )

    expect(status).toBe(409)
    expect(body).toMatchObject({ code: 'payment_method_unavailable' })
    // Refused before the intent exists, not after: an intent naming a stranger's card should
    // never be created at all.
    expect(stripeGateway.callsTo('paymentIntents.create')).toHaveLength(intentsBefore)
  })

  test('ignores an account holder the browser supplies', async ({ service, expect }) => {
    const victim = await shopperWithCard(service)
    const attacker = await shopperWithCard(service)
    const checkout = await payableCart(service)
    assertDefined(checkout.paymentCollection)

    // The whole attack in one request: name the victim's account holder, then their card.
    const { status } = await openSession(
      checkout.paymentCollection.id,
      {
        context: { accountHolder: { externalId: victim.gatewayCustomer.id } },
        data: { paymentMethodId: victim.method.id },
      },
      attacker.headers,
    )

    // The context arrives, is discarded, and the account holder is resolved from the caller's own
    // session — so the ownership check runs against the attacker and refuses before any intent
    // exists. A route that merged the browser's context would have charged the victim's card.
    expect(status).toBe(409)
    expect(stripeGateway.callsTo('paymentIntents.create')).toHaveLength(0)
  })
})

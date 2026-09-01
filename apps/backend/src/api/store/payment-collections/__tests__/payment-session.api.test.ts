import { BigNumber } from '@core/db/bignum.js'
import type { StoreCreatePaymentSessionResponse } from '@proteus/http-schemas/store'
import { stripeGateway } from '@tests/mocks/stripe.js'
import type { TestApi } from '@tests/setup/create-api.js'
import type { Fixtures } from '@tests/setup/test-extend.js'
import { test } from '@tests/setup/test-extend.js'
import { vi } from 'vitest'
import paymentCollectionDefinitions from '../definitions.js'

vi.mock('stripe', async () => (await import('@tests/mocks/stripe.js')).stripeModuleMock())

/** The DI key the Stripe adapter is registered under, which is what the route resolves. */
const STRIPE_PROVIDER = 'pp_stripe_default'

let api: TestApi

test.beforeEach(async ({ createApi }) => {
  stripeGateway.reset()
  api = await createApi({ definitions: paymentCollectionDefinitions })
})

/**
 * A collection at a chosen total, with the cart link the storefront's flow gives it. The session
 * the factory opens is on the system provider; the Stripe one is what each test then creates
 * through the route, so the amount under test is the collection's, not a generated one.
 */
async function collectionWorth(amount: string, currencyCode: string, service: Fixtures['service']) {
  const cart = await service.create.cart(api.container, { currencyCode })
  const { paymentCollection } = await service.create.paymentSessionForCart(api.container, {
    cartId: cart.id,
    amount: new BigNumber(amount),
    currencyCode,
  })
  return paymentCollection
}

const createSession = (collectionId: string) =>
  api.post<StoreCreatePaymentSessionResponse>(`/store/payment-collections/${collectionId}/payment-sessions`, {
    providerId: STRIPE_PROVIDER,
  })

/** What the gateway was asked to charge, for the single intent these tests create. */
function intentCreateParams() {
  const [call] = stripeGateway.callsTo('paymentIntents.create')
  if (!call) throw new Error('No PaymentIntent was created at the gateway')
  return call.params
}

test.describe('POST /store/payment-collections/:id/payment-sessions (stripe)', () => {
  test('sends a two-decimal total as a smallest-unit integer', async ({ service, expect }) => {
    const collection = await collectionWorth('19.99', 'usd', service)

    const { status } = await createSession(collection.id)

    expect(status).toBe(201)
    // 19.99 sent as-is is rejected by Stripe outright; 1999 is the charge the shopper agreed to.
    expect(intentCreateParams()).toMatchObject({ amount: 1999, currency: 'usd' })
  })

  test('sends a zero-decimal total unmultiplied', async ({ service, expect }) => {
    const collection = await collectionWorth('1000', 'jpy', service)

    await createSession(collection.id)

    // A blanket ×100 here would charge ¥100,000 for a ¥1,000 order.
    expect(intentCreateParams()).toMatchObject({ amount: 1000, currency: 'jpy' })
  })

  test("sends a three-decimal total on the currency's own exponent", async ({ service, expect }) => {
    const collection = await collectionWorth('19.99', 'bhd', service)

    await createSession(collection.id)

    expect(intentCreateParams()).toMatchObject({ amount: 19990, currency: 'bhd' })
  })

  test('carries the session id to the gateway so a webhook can be traced back', async ({ service, expect }) => {
    const collection = await collectionWorth('19.99', 'usd', service)

    const { body } = await createSession(collection.id)

    expect(intentCreateParams().metadata).toEqual({ sessionId: body.paymentSession.id })
  })

  test('reports a processing intent as pending, the same status the webhook path reports', async ({
    service,
    expect,
  }) => {
    // The two paths used to disagree about this one intent state: a session call called it
    // `pending_authorization` while a `payment_intent.processing` webhook called it `pending`.
    // They now read one table, so this status is the webhook action's status too.
    stripeGateway.statusOnCreate = 'processing'
    const collection = await collectionWorth('19.99', 'usd', service)

    const { body } = await createSession(collection.id)

    expect(body.paymentSession.status).toBe('pending')
  })

  test('reports a capturable intent as authorized', async ({ service, expect }) => {
    stripeGateway.statusOnCreate = 'requires_capture'
    const collection = await collectionWorth('19.99', 'usd', service)

    const { body } = await createSession(collection.id)

    expect(body.paymentSession.status).toBe('authorized')
  })
})

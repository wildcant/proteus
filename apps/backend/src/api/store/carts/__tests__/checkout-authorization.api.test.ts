import type { StoreCompleteCartResponse } from '@proteus/http-schemas/store'
import { type GatewayCall, stripeGateway } from '@tests/mocks/stripe.js'
import type { TestApi } from '@tests/setup/create-api.js'
import type { Fixtures } from '@tests/setup/test-extend.js'
import { test } from '@tests/setup/test-extend.js'
import { assertDefined } from '@tests/utils/assert-defined.js'
import Stripe from 'stripe'
import { vi } from 'vitest'
import cartDefinitions from '../definitions.js'

vi.mock('stripe', async () => (await import('@tests/mocks/stripe.js')).stripeModuleMock())

/**
 * What a shopper pressing **Place order** costs at the gateway.
 *
 * The module's own guards make a repeated authorization refuse rather than charge twice; the
 * idempotency key is the second line of defence, for the case those guards cannot see — a write
 * that reached Stripe and whose answer never came back. Both are asserted here, because either
 * one alone leaves a way to charge a shopper twice.
 */

const STRIPE_PROVIDER = 'pp_stripe_default'

const connectionError = () => new Stripe.errors.StripeConnectionError({ message: 'socket hang up' })

let api: TestApi

test.beforeEach(async ({ createApi }) => {
  stripeGateway.reset()
  // The state a card checkout reaches once the browser has confirmed: Stripe already has the
  // money, so authorizing the session both creates the Payment and captures it.
  stripeGateway.statusOnCreate = 'succeeded'
  api = await createApi({ definitions: cartDefinitions })
})

const completeCart = (cartId: string) => api.post<StoreCompleteCartResponse>(`/store/carts/${cartId}/complete`)

const keyOf = (call: GatewayCall) => (call.params.options as { idempotencyKey?: string } | undefined)?.idempotencyKey

async function payableCart(service: Fixtures['service']) {
  const checkout = await service.create.checkoutReadyCart(api.container, {
    cart: { currencyCode: 'usd' },
    payment: { providerId: STRIPE_PROVIDER },
    addresses: {},
  })
  assertDefined(checkout.paymentCollection)
  return checkout
}

async function capturesFor(service: Fixtures['service'], paymentCollectionId: string) {
  const collection = await service.read.paymentCollection(api.container, paymentCollectionId)
  return collection.payments?.flatMap((payment) => payment.captures ?? []) ?? []
}

test.describe('POST /store/carts/:id/complete — charging once', () => {
  test('charges once when the button is pressed twice', async ({ service, expect }) => {
    const checkout = await payableCart(service)
    assertDefined(checkout.paymentCollection)

    const first = await completeCart(checkout.cart.id)
    const second = await completeCart(checkout.cart.id)

    // The second press is answered with the order the first one placed, not a second checkout.
    expect(first.status).toBe(200)
    expect(second.body.orderId).toBe(first.body.orderId)
    expect(stripeGateway.callsTo('paymentIntents.capture')).toHaveLength(1)
    expect(await capturesFor(service, checkout.paymentCollection.id)).toHaveLength(1)
  })

  test('charges once when two presses land at the same moment', async ({ service, expect }) => {
    const checkout = await payableCart(service)
    assertDefined(checkout.paymentCollection)

    const [first, second] = await Promise.all([completeCart(checkout.cart.id), completeCart(checkout.cart.id)])

    // One of the two wins the order↔cart link and the other unwinds; which is which is a race, so
    // the assertion is on the money rather than on the winner.
    expect([first.status, second.status]).toContain(200)
    expect(stripeGateway.callsTo('paymentIntents.capture')).toHaveLength(1)
    expect(await capturesFor(service, checkout.paymentCollection.id)).toHaveLength(1)
  })

  test('charges once when the capture is retried after the gateway drops the connection', async ({
    service,
    expect,
  }) => {
    const checkout = await payableCart(service)
    assertDefined(checkout.paymentCollection)

    // The first capture may or may not have reached Stripe — a dropped connection cannot tell us.
    // Retrying is only safe because the key is the same, so Stripe answers the second attempt
    // from the first one's result instead of taking the money again.
    stripeGateway.failNext('paymentIntents.capture', connectionError())

    const { status } = await completeCart(checkout.cart.id)

    expect(status).toBe(200)
    const keys = stripeGateway.callsTo('paymentIntents.capture').map(keyOf)
    expect(keys).toHaveLength(2)
    expect(keys[0]).toBeDefined()
    expect(keys[0]).toBe(keys[1])
    expect(await capturesFor(service, checkout.paymentCollection.id)).toHaveLength(1)
  })
})

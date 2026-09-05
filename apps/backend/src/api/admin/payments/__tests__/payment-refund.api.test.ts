import { type GatewayCall, stripeGateway } from '@tests/mocks/stripe.js'
import type { TestApi } from '@tests/setup/create-api.js'
import type { Fixtures } from '@tests/setup/test-extend.js'
import { test } from '@tests/setup/test-extend.js'
import { assertDefined } from '@tests/utils/assert-defined.js'
import Stripe from 'stripe'
import { vi } from 'vitest'
import paymentDefinitions from '../definitions.js'

vi.mock('stripe', async () => (await import('@tests/mocks/stripe.js')).stripeModuleMock())

/** The DI key the Stripe adapter is registered under. */
const STRIPE_PROVIDER = 'pp_stripe_default'

let api: TestApi

test.beforeEach(async ({ createApi }) => {
  stripeGateway.reset()
  api = await createApi({ definitions: paymentDefinitions })
})

/** A payment taken through the gateway and captured, which is all a refund can be made against. */
async function capturedPayment(service: Fixtures['service'], currencyCode: string) {
  const checkout = await service.create.order(api.container, {
    cart: { currencyCode },
    payment: { providerId: STRIPE_PROVIDER },
  })

  const collection = checkout.paymentCollection
  assertDefined(collection)
  const authorized = (await service.read.paymentCollection(api.container, collection.id)).payments?.[0]
  assertDefined(authorized)

  await service.create.capturedPayment(api.container, authorized.id)

  return { paymentId: authorized.id, total: checkout.total }
}

/** What the gateway was asked to refund. */
function refundParams() {
  const [call] = stripeGateway.callsTo('refunds.create')
  if (!call) throw new Error('No refund was created at the gateway')
  return call.params
}

/** The idempotency key a recorded call carried, or undefined if it went out unkeyed. */
const keyOf = (call: GatewayCall) => (call.params.options as { idempotencyKey?: string } | undefined)?.idempotencyKey

const refundKeys = () => stripeGateway.callsTo('refunds.create').map(keyOf)

test.describe('POST /admin/payments/:id/refund (stripe)', () => {
  test('sends the refund in the smallest unit, like the charge it reverses', async ({ service, expect }) => {
    const { paymentId, total } = await capturedPayment(service, 'usd')

    const { status } = await api.post(`/admin/payments/${paymentId}/refund`, { amount: total.toFixed() })

    expect(status).toBe(200)
    expect(refundParams().amount).toBe(total.multipliedBy(100).toNumber())
  })

  test('converts a partial refund on the same exponent', async ({ service, expect }) => {
    const { paymentId } = await capturedPayment(service, 'usd')

    await api.post(`/admin/payments/${paymentId}/refund`, { amount: '5.55' })

    expect(refundParams().amount).toBe(555)
  })

  test('leaves a zero-decimal refund unmultiplied', async ({ service, expect }) => {
    const { paymentId, total } = await capturedPayment(service, 'jpy')

    await api.post(`/admin/payments/${paymentId}/refund`, { amount: total.toFixed() })

    // The currency comes from the payment being refunded — the adapter is never told it twice,
    // and a ×100 here would refund a hundred times what was charged.
    expect(refundParams().amount).toBe(total.toNumber())
  })
})

/**
 * The refund key has to survive the transaction it is created in.
 *
 * Both this path and the capture path write their row inside `withTransaction` and then call the
 * gateway. A crash between the insert and the acknowledgement rolls the row back — so a key taken
 * from that row's id is a *different* key on the retry. Capture survives that: it takes the whole
 * authorization, so the outstanding-amount check refuses the retry and Stripe refuses a second
 * capture anyway. A partial refund has neither backstop — the charge is not fully refunded, so
 * `charge_already_refunded` never fires, and the rolled-back row is gone from the already-refunded
 * total too. Without a rollback-proof key, Stripe simply makes a second refund.
 */
test.describe('POST /admin/payments/:id/refund — the key across a rollback', () => {
  test('presents the same key when a refund is retried after its row rolled back', async ({ service, expect }) => {
    const { paymentId } = await capturedPayment(service, 'usd')

    // The first attempt dies at the gateway, which is what a crash mid-refund looks like from
    // here: the transaction unwinds and the Refund row never existed.
    stripeGateway.failNext(
      'refunds.create',
      new Stripe.errors.StripeAPIError({ type: 'api_error', message: 'Something went wrong' }),
    )
    const failed = await api.post(`/admin/payments/${paymentId}/refund`, { amount: '5.55' })
    expect(failed.status).toBe(503)

    const retried = await api.post(`/admin/payments/${paymentId}/refund`, { amount: '5.55' })
    expect(retried.status).toBe(200)

    // Same key on both attempts, so Stripe answers the second from the first one's result rather
    // than taking another 5.55 from the shopper.
    const keys = refundKeys()
    expect(keys).toHaveLength(2)
    expect(keys[0]).toBeDefined()
    expect(keys[0]).toBe(keys[1])
  })

  test('keys two genuine partial refunds apart', async ({ service, expect }) => {
    const { paymentId } = await capturedPayment(service, 'usd')

    await api.post(`/admin/payments/${paymentId}/refund`, { amount: '5.55' })
    await api.post(`/admin/payments/${paymentId}/refund`, { amount: '5.55' })

    // Two refunds of the same amount are two operations and must not deduplicate. The second sees
    // the first in the already-refunded total, which is what separates them.
    const keys = refundKeys()
    expect(keys).toHaveLength(2)
    expect(keys[0]).not.toBe(keys[1])
  })
})

import { stripeGateway } from '@tests/mocks/stripe.js'
import type { TestApi } from '@tests/setup/create-api.js'
import type { Fixtures } from '@tests/setup/test-extend.js'
import { test } from '@tests/setup/test-extend.js'
import { assertDefined } from '@tests/utils/assert-defined.js'
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

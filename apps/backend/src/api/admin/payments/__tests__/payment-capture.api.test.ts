import { stripeGateway } from '@tests/mocks/stripe.js'
import type { ApiErrorBody, TestApi } from '@tests/setup/create-api.js'
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

/** An authorized, uncaptured payment — where a manual-capture checkout leaves a merchant. */
async function authorizedPayment(service: Fixtures['service']) {
  const checkout = await service.create.order(api.container, {
    cart: { currencyCode: 'usd' },
    payment: { providerId: STRIPE_PROVIDER },
  })

  const collection = checkout.paymentCollection
  assertDefined(collection)
  const payment = (await service.read.paymentCollection(api.container, collection.id)).payments?.[0]
  assertDefined(payment)

  return { paymentId: payment.id, paymentCollectionId: collection.id, total: checkout.total }
}

/** The payment as it stands now, with the capture rows that are its ledger. */
async function paymentNow(service: Fixtures['service'], paymentCollectionId: string) {
  const payment = (await service.read.paymentCollection(api.container, paymentCollectionId)).payments?.[0]
  assertDefined(payment)
  return payment
}

test.describe('POST /admin/payments/:id/capture (stripe)', () => {
  test('takes the whole authorization when the body is empty', async ({ service, expect }) => {
    const { paymentId, paymentCollectionId, total } = await authorizedPayment(service)

    const { status } = await api.post(`/admin/payments/${paymentId}/capture`)

    expect(status).toBe(200)
    expect(stripeGateway.callsTo('paymentIntents.capture')).toHaveLength(1)

    const payment = await paymentNow(service, paymentCollectionId)
    expect(payment.capturedAt).not.toBeNull()
    expect(payment.captures?.map((capture) => capture.amount.toFixed())).toEqual([total.toFixed()])
  })

  test('refuses a request that asks for part of the authorization', async ({ service, expect }) => {
    const { paymentId, paymentCollectionId } = await authorizedPayment(service)

    const response = await api.post<ApiErrorBody>(`/admin/payments/${paymentId}/capture`, { amount: '40.00' })

    // Loudly, and not by ignoring the field: Stripe's capture call carries no `amount_to_capture`,
    // so a request that believes it is taking 40 of a 100 authorization would take all 100 and
    // report success. Refusing it is the whole point of the field being gone.
    expect(response.status).toBe(400)
    expect(response.body.message).toBe('Invalid request body: Unrecognized keys: "amount"')

    expect(stripeGateway.callsTo('paymentIntents.capture')).toHaveLength(0)
    const payment = await paymentNow(service, paymentCollectionId)
    expect(payment.capturedAt).toBeNull()
    expect(payment.captures ?? []).toHaveLength(0)
  })

  test('refuses a second capture rather than answering success', async ({ service, expect }) => {
    const { paymentId, paymentCollectionId, total } = await authorizedPayment(service)

    const first = await api.post(`/admin/payments/${paymentId}/capture`)
    const second = await api.post<ApiErrorBody>(`/admin/payments/${paymentId}/capture`)

    expect([first.status, second.status]).toEqual([200, 400])
    expect(second.body.message).toBe(`Payment "${paymentId}" has already been fully captured.`)

    // One capture at the gateway and one row behind it. A merchant double-clicking Capture is the
    // ordinary way here, and the money must be taken once.
    expect(stripeGateway.callsTo('paymentIntents.capture')).toHaveLength(1)
    const payment = await paymentNow(service, paymentCollectionId)
    expect(payment.captures?.map((capture) => capture.amount.toFixed())).toEqual([total.toFixed()])
  })
})

import { type FakeIntent, stripeGateway } from '@tests/mocks/stripe.js'
import type { ApiErrorBody, TestApi } from '@tests/setup/create-api.js'
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

  const session = checkout.paymentSession
  assertDefined(session)
  const intent = stripeGateway.intentForSession(session.id)
  assertDefined(intent)

  return { paymentId: payment.id, paymentCollectionId: collection.id, total: checkout.total, intent }
}

/**
 * What Stripe answers to a write against an intent that cannot take it.
 *
 * One code covers every one of those states — `canceled`, `requires_payment_method`,
 * `requires_confirmation`, `processing`, `requires_action` and `succeeded` — which is exactly why
 * reading the code alone is not enough to tell a completed operation from a refused one. The
 * message is Stripe's own wording for the cancelled case.
 */
const unexpectedState = (message: string) =>
  new Stripe.errors.StripeInvalidRequestError({
    type: 'invalid_request_error',
    code: 'payment_intent_unexpected_state',
    message,
  })

/** Puts the gateway's intent into a state, the way something outside this process would. */
function intentBecomes(intent: FakeIntent, status: Stripe.PaymentIntent.Status) {
  intent.status = status
}

/** The gateway calls made since `from`, in order, as bare method names. */
const callsSince = (from: number) => stripeGateway.calls.slice(from).map((call) => call.method)

/** The payment as it stands now, with the capture rows that are its ledger. */
async function paymentNow(service: Fixtures['service'], paymentCollectionId: string) {
  const payment = (await service.read.paymentCollection(api.container, paymentCollectionId)).payments?.[0]
  assertDefined(payment)
  return payment
}

test.describe('POST /admin/payments/:id/capture (stripe)', () => {
  test('takes the whole authorization', async ({ service, expect }) => {
    const { paymentId, paymentCollectionId, total } = await authorizedPayment(service)

    const { status } = await api.post(`/admin/payments/${paymentId}/capture`)

    expect(status).toBe(200)
    expect(stripeGateway.callsTo('paymentIntents.capture')).toHaveLength(1)

    const payment = await paymentNow(service, paymentCollectionId)
    expect(payment.capturedAt).not.toBeNull()
    expect(payment.captures?.map((capture) => capture.amount.toFixed())).toEqual([total.toFixed()])
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

/**
 * `payment_intent_unexpected_state` is not a synonym for "already done".
 *
 * Stripe returns it for a capture against a cancelled intent, one still awaiting a payment
 * method, one confirming, one processing and one awaiting an action — as well as for the single
 * case that really is done. Treating the code as success writes a Capture row for money the
 * gateway never took, and the ledger then disagrees with the bank with nothing above `debug` to
 * say so.
 */
test.describe('POST /admin/payments/:id/capture — refusals that are not successes', () => {
  test('raises when the authorization was cancelled, rather than recording a capture', async ({ service, expect }) => {
    const { paymentId, paymentCollectionId, intent } = await authorizedPayment(service)

    // Cancelled at Stripe — by the dashboard, or by an expiry — after we authorized it.
    intentBecomes(intent, 'canceled')
    stripeGateway.failNext(
      'paymentIntents.capture',
      unexpectedState('This PaymentIntent could not be captured because it has a status of canceled.'),
    )

    const response = await api.post<ApiErrorBody>(`/admin/payments/${paymentId}/capture`)

    expect(response.status).toBe(500)
    expect(response.body.code).toBe('payment_gateway_error')

    // Nothing taken, so nothing recorded. This is the assertion that fails if the adapter reads
    // the error code without asking what state the intent is actually in.
    const payment = await paymentNow(service, paymentCollectionId)
    expect(payment.capturedAt).toBeNull()
    expect(payment.captures ?? []).toHaveLength(0)
  })

  test('still treats a capture the gateway already made as success', async ({ service, expect }) => {
    const { paymentId, paymentCollectionId, total, intent } = await authorizedPayment(service)

    // The other side of the same coin: auto-capture, or a redelivered webhook, got there first.
    intentBecomes(intent, 'succeeded')
    stripeGateway.failNext(
      'paymentIntents.capture',
      unexpectedState('This PaymentIntent could not be captured because it has a status of succeeded.'),
    )

    const { status } = await api.post(`/admin/payments/${paymentId}/capture`)

    expect(status).toBe(200)
    const payment = await paymentNow(service, paymentCollectionId)
    expect(payment.captures?.map((capture) => capture.amount.toFixed())).toEqual([total.toFixed()])
  })

  test('raises when a cancel would be written over a captured payment', async ({ service, expect }) => {
    const { paymentId, paymentCollectionId, intent } = await authorizedPayment(service)

    // The mirror bug: Stripe refuses to cancel an intent it has already charged, with the same
    // code — and swallowing it stamps `canceledAt` on a payment the shopper really paid.
    intentBecomes(intent, 'succeeded')
    stripeGateway.failNext(
      'paymentIntents.cancel',
      unexpectedState('You cannot cancel this PaymentIntent because it has a status of succeeded.'),
    )

    await expect(service.create.canceledPayment(api.container, paymentId)).rejects.toThrow()

    expect((await paymentNow(service, paymentCollectionId)).canceledAt).toBeNull()
  })

  test('still treats an intent the gateway already cancelled as cancelled', async ({ service, expect }) => {
    const { paymentId, paymentCollectionId, intent } = await authorizedPayment(service)

    intentBecomes(intent, 'canceled')
    stripeGateway.failNext(
      'paymentIntents.cancel',
      unexpectedState('You cannot cancel this PaymentIntent because it has a status of canceled.'),
    )

    const before = stripeGateway.calls.length
    await service.create.canceledPayment(api.container, paymentId)

    expect((await paymentNow(service, paymentCollectionId)).canceledAt).not.toBeNull()
    // The write goes first and the status is read only because the write was refused. The
    // pre-flight retrieve this replaced asked before every cancel, and bought a time-of-check
    // race for the trouble: an intent can be captured between the read and the cancel.
    expect(callsSince(before)).toEqual(['paymentIntents.cancel', 'paymentIntents.retrieve'])
  })

  test('cancels in one round trip when the gateway does not object', async ({ service, expect }) => {
    const { paymentId, paymentCollectionId } = await authorizedPayment(service)

    const before = stripeGateway.calls.length
    await service.create.canceledPayment(api.container, paymentId)

    expect((await paymentNow(service, paymentCollectionId)).canceledAt).not.toBeNull()
    expect(callsSince(before)).toEqual(['paymentIntents.cancel'])
  })
})

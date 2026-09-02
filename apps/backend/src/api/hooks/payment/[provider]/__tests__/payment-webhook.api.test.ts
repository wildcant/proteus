import { BigNumber } from '@core/db/bignum.js'
import { type FakeIntent, signWebhook, stripeGateway, webhookEventBody } from '@tests/mocks/stripe.js'
import type { ApiErrorBody, TestApi } from '@tests/setup/create-api.js'
import type { Fixtures } from '@tests/setup/test-extend.js'
import { test } from '@tests/setup/test-extend.js'
import { assertDefined } from '@tests/utils/assert-defined.js'
import { vi } from 'vitest'
import { env } from '../../../../../env.js'
import hookDefinitions from '../../../definitions.js'

vi.mock('stripe', async () => (await import('@tests/mocks/stripe.js')).stripeModuleMock())

/** The DI key the Stripe adapter is registered under, and so the `:provider` segment the
 *  gateway's webhook endpoint is configured with. */
const STRIPE_PROVIDER = 'pp_stripe_default'

/** The two rejections the route can answer with, which are only told apart by what they say. */
const SIGNATURE_REJECTION = 'Webhook signature verification failed'
const MISSING_HEADER_REJECTION = 'Missing stripe-signature header'

let api: TestApi

test.beforeEach(async ({ createApi }) => {
  stripeGateway.reset()
  api = await createApi({ definitions: hookDefinitions })
})

/**
 * An order whose payment is authorized and not yet captured — where a manual-capture checkout
 * leaves things, and the state a `payment_intent.succeeded` webhook arrives into. The intent
 * comes back too, because the event Stripe sends is that intent in a later state.
 */
async function authorizedOrder(service: Fixtures['service']) {
  const checkout = await service.create.order(api.container, {
    cart: { currencyCode: 'usd' },
    payment: { providerId: STRIPE_PROVIDER },
  })

  const session = checkout.paymentSession
  assertDefined(session)
  const intent = stripeGateway.intentForSession(session.id)
  assertDefined(intent)

  return { session, intent, total: checkout.total }
}

const postWebhook = (body: string, headers: Record<string, string>) =>
  api.request.post(`/hooks/payment/${STRIPE_PROVIDER}`).set('content-type', 'application/json').set(headers).send(body)

const signedHeaders = (body: string) => ({ 'stripe-signature': signWebhook(body, env.STRIPE_WEBHOOK_SECRET) })

/** The event Stripe sends once the funds are through: the same intent, now succeeded. */
const succeededEvent = (intent: FakeIntent) =>
  webhookEventBody('payment_intent.succeeded', { ...intent, status: 'succeeded' })

/** The payment behind a session, with its captures. */
async function paymentFor(service: Fixtures['service'], paymentCollectionId: string) {
  const collection = await service.read.paymentCollection(api.container, paymentCollectionId)
  const payment = collection.payments?.[0]
  assertDefined(payment)
  return payment
}

/**
 * A session Stripe has already charged, with no Payment behind it yet — a shopper who closed the
 * tab after confirming, whose first news of the charge is the webhook itself.
 */
async function chargedSessionWithoutPayment(service: Fixtures['service']) {
  stripeGateway.statusOnCreate = 'succeeded'

  const cart = await service.create.cart(api.container, { currencyCode: 'usd' })
  const { paymentCollection, paymentSession } = await service.create.paymentSessionForCart(api.container, {
    cartId: cart.id,
    amount: new BigNumber('19.99'),
    currencyCode: 'usd',
    providerId: STRIPE_PROVIDER,
  })

  const intent = stripeGateway.intentForSession(paymentSession.id)
  assertDefined(intent)

  return { paymentCollectionId: paymentCollection.id, intent, total: new BigNumber('19.99') }
}

test.describe('POST /hooks/payment/:provider', () => {
  test('captures the amount the event reports, converted back to major units', async ({ service, expect }) => {
    const { session, intent, total } = await authorizedOrder(service)
    const body = succeededEvent(intent)

    // The fixture is deliberately not what `JSON.stringify(req.body)` produces. If the route
    // re-serialised the parsed body the signature below would not verify, which is the whole
    // reason the raw bytes are carried through the request port.
    expect(JSON.stringify(JSON.parse(body))).not.toBe(body)

    const response = await postWebhook(body, signedHeaders(body))

    expect(response.status).toBe(200)

    // The intent reports the total in cents; the payment is recorded in dollars. Passing the
    // smallest-unit integer upward is rejected as exceeding the capturable amount, which is how
    // this failed on every real webhook.
    const payment = await paymentFor(service, session.paymentCollectionId)
    expect(payment.capturedAt).not.toBeNull()
    expect(payment.captures?.map((capture) => capture.amount.toFixed())).toEqual([total.toFixed()])
  })

  test('captures once when the same event is delivered twice', async ({ service, expect }) => {
    const { session, intent, total } = await authorizedOrder(service)
    const body = succeededEvent(intent)

    const first = await postWebhook(body, signedHeaders(body))
    const second = await postWebhook(body, signedHeaders(body))

    // Stripe redelivers until it is acknowledged, and answers a 4xx by retrying for three days
    // and then disabling the endpoint. A replay has to be a 200, not an error about money that
    // was already taken.
    expect([first.status, second.status]).toEqual([200, 200])

    const payment = await paymentFor(service, session.paymentCollectionId)
    expect(payment.captures?.map((capture) => capture.amount.toFixed())).toEqual([total.toFixed()])
  })

  test('captures once when the charge is already complete before any payment exists', async ({ service, expect }) => {
    // The other way the same double capture used to surface: no Payment yet, so authorizing the
    // session creates one and captures it in the same call, leaving nothing for the route to take.
    const { paymentCollectionId, intent, total } = await chargedSessionWithoutPayment(service)
    const body = succeededEvent(intent)

    const response = await postWebhook(body, signedHeaders(body))

    expect(response.status).toBe(200)

    const payment = await paymentFor(service, paymentCollectionId)
    expect(payment.captures?.map((capture) => capture.amount.toFixed())).toEqual([total.toFixed()])
  })

  test('rejects a body altered after it was signed, and says so', async ({ service, expect }) => {
    const { session, intent } = await authorizedOrder(service)
    const signed = succeededEvent(intent)

    // Same JSON, different bytes — what a re-serialisation, or a proxy reformatting the payload,
    // produces. Stripe signed the bytes, not the meaning.
    const altered = JSON.stringify(JSON.parse(signed))
    const response = await postWebhook(altered, signedHeaders(signed))
    const body = response.body as ApiErrorBody

    // The reason matters as much as the status: a route that never received the raw bytes at all
    // also answers 400, and this case has to fail for its own reason rather than that one.
    expect(response.status).toBe(400)
    expect(body.message).toBe(SIGNATURE_REJECTION)
    expect((await paymentFor(service, session.paymentCollectionId)).capturedAt).toBeNull()
  })

  test('rejects a request with no stripe-signature header, for a different reason again', async ({
    service,
    expect,
  }) => {
    const { session, intent } = await authorizedOrder(service)

    const response = await postWebhook(succeededEvent(intent), {})
    const body = response.body as ApiErrorBody

    expect(response.status).toBe(400)
    expect(body.message).toBe(MISSING_HEADER_REJECTION)
    expect(body.message).not.toBe(SIGNATURE_REJECTION)
    expect((await paymentFor(service, session.paymentCollectionId)).capturedAt).toBeNull()
  })

  test('acknowledges an event it does not act on without touching the payment', async ({ service, expect }) => {
    const { session, intent } = await authorizedOrder(service)
    const body = webhookEventBody('payment_intent.processing', { ...intent, status: 'processing' })

    const response = await postWebhook(body, signedHeaders(body))

    // A settling payment is acknowledged so Stripe stops redelivering it, and nothing else.
    expect(response.status).toBe(200)
    expect(stripeGateway.callsTo('paymentIntents.capture')).toHaveLength(0)
    expect((await paymentFor(service, session.paymentCollectionId)).capturedAt).toBeNull()
  })

  test('ignores an event from another integration on the same Stripe account', async ({ service, expect }) => {
    const { session, intent } = await authorizedOrder(service)
    const body = webhookEventBody('payment_intent.succeeded', { ...intent, status: 'succeeded', metadata: {} })

    const response = await postWebhook(body, signedHeaders(body))

    expect(response.status).toBe(200)
    expect((await paymentFor(service, session.paymentCollectionId)).capturedAt).toBeNull()
  })
})

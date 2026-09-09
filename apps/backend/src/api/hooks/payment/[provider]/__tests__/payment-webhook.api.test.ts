import { createHmac } from 'node:crypto'
import { BigNumber } from '@core/bignumber.js'
import type { EventBus } from '@core/event-bus/types.js'
import type { IPaymentModuleService } from '@core/types/index.js'
import { PaymentErrorCodes } from '@core/types/payment/errors.js'
import { ContainerRegistrationKeys, Modules } from '@core/utils/index.js'
import { env } from '@env'
import type { FakeIntent } from '@tests/mocks/stripe-factories.js'
import { stripeTest } from '@tests/mocks/vitest/stripe.mock.js'
import { stripeErrors } from '@tests/mocks/vitest/stripe-errors.js'
import type { ApiErrorBody, TestApi } from '@tests/setup/create-api.js'
import type { Fixtures } from '@tests/setup/test-extend.js'
import { test } from '@tests/setup/test-extend.js'
import { assertDefined } from '@tests/utils/assert-defined.js'
import { completeCartWorkflow } from '@workflows/cart/complete-cart.js'
import type { ExpectStatic } from 'vitest'
import { vi } from 'vitest'
import hookDefinitions from '../../../definitions.js'

vi.mock('stripe', async () => (await import('@tests/mocks/vitest/stripe.mock.js')).stripeTest.moduleMock())

/**
 * Stripe's documented signature scheme: an HMAC-SHA256 over `<timestamp>.<payload>`. Written out
 * rather than taken from the SDK's test helper so this pins the wire format itself.
 */
function signWebhook(payload: string | Uint8Array, secret: string, timestamp = Math.floor(Date.now() / 1000)) {
  const body = typeof payload === 'string' ? payload : new TextDecoder('utf8').decode(payload)
  const signature = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')
  return `t=${timestamp},v1=${signature}`
}

/** A webhook event body around an intent, serialized the way Stripe sends it — indented. */
function webhookEventBody(type: string, intent: FakeIntent, id = 'evt_test'): string {
  return JSON.stringify({ id, object: 'event', type, data: { object: intent } }, null, 2)
}

/** The DI key the Stripe adapter is registered under, and so the `:provider` segment the
 *  gateway's webhook endpoint is configured with. */
const STRIPE_PROVIDER = 'pp_stripe_default'

/** The two rejections the route can answer with, which are only told apart by what they say. */
const SIGNATURE_REJECTION = 'Webhook signature verification failed'
const MISSING_HEADER_REJECTION = 'Missing stripe-signature header'

let api: TestApi

test.beforeEach(async ({ createApi }) => {
  stripeTest.reset()
  api = await createApi({ definitions: hookDefinitions })
})

const paymentModule = (target: TestApi = api) => target.container.resolve<IPaymentModuleService>(Modules.PAYMENT)

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
  const intent = await stripeTest.intentCreatedFor(session.id)
  assertDefined(intent)

  return { session, intent, total: checkout.total }
}

const postWebhook = (body: string, headers: Record<string, string>, target: TestApi = api) =>
  target.request
    .post(`/hooks/payment/${STRIPE_PROVIDER}`)
    .set('content-type', 'application/json')
    .set(headers)
    .send(body)

const signedHeaders = (body: string) => ({ 'stripe-signature': signWebhook(body, env.STRIPE_WEBHOOK_SECRET) })

/** The event Stripe sends once the funds are through: the same intent, now succeeded. */
const succeededEvent = (intent: FakeIntent) =>
  webhookEventBody('payment_intent.succeeded', {
    ...intent,
    status: 'succeeded',
    // biome-ignore lint/style/useNamingConvention: the Stripe field the adapter reads
    amount_received: intent.amount,
    // biome-ignore lint/style/useNamingConvention: the Stripe field the adapter reads
    amount_capturable: 0,
  })

/**
 * The event Stripe sends when a manual-capture intent is confirmed — funds held, not taken.
 *
 * This is the *first* webhook of an ordinary card checkout here, not an edge case: the adapter opens
 * every intent with `capture_method: 'manual'`, so a confirmed card lands on `requires_capture` and
 * the action is `authorized`.
 */
const capturableEvent = (intent: FakeIntent) =>
  webhookEventBody('payment_intent.amount_capturable_updated', {
    ...intent,
    status: 'requires_capture',
    // biome-ignore lint/style/useNamingConvention: the Stripe field the adapter reads
    amount_received: 0,
    // biome-ignore lint/style/useNamingConvention: the Stripe field the adapter reads
    amount_capturable: intent.amount,
  })

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
  stripeTest.givenIntentStatus('succeeded')

  const cart = await service.create.cart(api.container, { currencyCode: 'usd' })
  const { paymentCollection, paymentSession } = await service.create.paymentSessionForCart(api.container, {
    cartId: cart.id,
    amount: new BigNumber('19.99'),
    currencyCode: 'usd',
    providerId: STRIPE_PROVIDER,
  })

  const intent = await stripeTest.intentCreatedFor(paymentSession.id)
  assertDefined(intent)

  return { session: paymentSession, paymentCollectionId: paymentCollection.id, intent, total: new BigNumber('19.99') }
}

test.describe('POST /hooks/payment/:provider', () => {
  test('captures the authorization in full when the charge succeeds', async ({ service, expect }) => {
    const { session, intent, total } = await authorizedOrder(service)
    const body = succeededEvent(intent)

    // The fixture is deliberately not what `JSON.stringify(req.body)` produces. If the route
    // re-serialised the parsed body the signature below would not verify, which is the whole
    // reason the raw bytes are carried through the request port.
    expect(JSON.stringify(JSON.parse(body))).not.toBe(body)

    const response = await postWebhook(body, signedHeaders(body))

    expect(response.status).toBe(200)

    // A capture takes the whole authorization and nothing about the event's own amount decides
    // it, so the row is the payment's total in major units — dollars, where the intent counts
    // cents. What the event reports is read for the action, not the money.
    const payment = await paymentFor(service, session.paymentCollectionId)
    expect(payment.capturedAt).not.toBeNull()
    expect(payment.captures?.map((capture) => capture.amount.toFixed())).toEqual([total.toFixed()])
  })

  /**
   * The route's whole job, and the assertion that it is the whole job.
   *
   * With the publish intercepted, nothing downstream runs — and nothing happens. That is the point:
   * the state transition is a subscriber's, so it survives this process dying and retries on its own
   * bounded budget instead of waiting for Stripe to redeliver, which used to be the only retry there
   * was. Every other test in this file sees the capture because the suite pins the in-process
   * adapter, which runs the subscriber inside `emit`.
   */
  test('publishes what the provider reported and does nothing else itself', async ({ service, expect }) => {
    const { session, intent } = await authorizedOrder(service)
    const bus = api.container.resolve<EventBus>(ContainerRegistrationKeys.EVENT_BUS)
    const emit = vi.spyOn(bus, 'emit').mockResolvedValue(undefined)

    const body = succeededEvent(intent)
    const response = await postWebhook(body, signedHeaders(body))

    expect(response.status).toBe(200)
    // The session's id, not the intent's: the payload names the resource this backend owns, and it
    // is what the payment, the collection and the cart behind it are all reachable through.
    expect(emit).toHaveBeenCalledExactlyOnceWith('payment.captured', { id: session.id, action: 'captured' })
    expect(await paymentFor(service, session.paymentCollectionId)).toMatchObject({ capturedAt: null })
  })

  /**
   * The delivery a card checkout produces first, and the one no test used to cover.
   *
   * Under `capture_method: 'manual'` a confirmed intent is `requires_capture`, so the ordinary first
   * event of every card checkout publishes `action: 'authorized'`. It has to reach the subscriber —
   * the completion re-run is deliberately not gated on the action — and it must not take any money,
   * because the shopper has not been charged yet and a capture here would be the route deciding to.
   */
  test('publishes the authorization a manual-capture checkout reports first, and takes no money', async ({
    service,
    expect,
  }) => {
    const { session, intent } = await authorizedOrder(service)
    const bus = api.container.resolve<EventBus>(ContainerRegistrationKeys.EVENT_BUS)
    const emit = vi.spyOn(bus, 'emit')

    const body = capturableEvent(intent)
    const response = await postWebhook(body, signedHeaders(body))

    expect(response.status).toBe(200)
    expect(emit).toHaveBeenCalledExactlyOnceWith('payment.captured', { id: session.id, action: 'authorized' })

    // Through the real subscriber, not a mocked publish: the suite pins the in-process adapter, so
    // what this asserts is that the subscriber left the money where it was.
    expect(stripeTest.mock.paymentIntents.capture).not.toHaveBeenCalled()
    expect(await paymentFor(service, session.paymentCollectionId)).toMatchObject({ capturedAt: null })
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

  test('takes the money for a settling payment on a cart that cannot become an order', async ({ service, expect }) => {
    // The capture path on its own, with the completion re-run deliberately unable to finish.
    //
    // This cart is a bare one — no email, no shipping method, no address — so the re-run the
    // `payment.captured` subscriber performs fails on the first validation step, every time. That
    // is the point of the fixture: it isolates what the *route* does from what the subscriber
    // manages to do with it, and the describe block below covers the case that does end in an
    // order. It is also the never-reject contract under load — the subscriber throws here, and a
    // publisher must not learn about it.
    //
    // Not a residual any more. When the cart *can* complete, the shopper gets the order they paid
    // for; see "a payment that settled after checkout was refused". What survives from before the
    // event bus is only this: a capture stands on its own, whatever becomes of the completion.
    stripeTest.givenIntentStatus('processing')

    const cart = await service.create.cart(api.container, { currencyCode: 'usd' })
    const { paymentCollection, paymentSession } = await service.create.paymentSessionForCart(api.container, {
      cartId: cart.id,
      amount: new BigNumber('19.99'),
      currencyCode: 'usd',
      providerId: STRIPE_PROVIDER,
    })

    const intent = await stripeTest.intentCreatedFor(paymentSession.id)
    assertDefined(intent)

    // Still settling, and said so in its own words: this is the classification the checkout turns
    // into a 409 rather than the decline's `unexpected_state`. Asserted here because everything
    // below depends on the completion having been refused for *this* reason.
    const authorization = await paymentModule().authorizePaymentSession(paymentSession.id)
    expect(authorization).toMatchObject({ outcome: 'pending_authorization' })

    // The funds clear.
    stripeTest.givenRetrievedStatus('succeeded')
    const response = await postWebhook(succeededEvent(intent), signedHeaders(succeededEvent(intent)))
    expect(response.status).toBe(200)

    // Captured — in full, against a cart with no order behind it, because this one cannot have one.
    const payment = await paymentFor(service, paymentCollection.id)
    expect(payment.capturedAt).not.toBeNull()
    expect(payment.captures?.map((capture) => capture.amount.toFixed())).toEqual([new BigNumber('19.99').toFixed()])
    expect(await service.read.orders(api.container)).toEqual([])
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

  test('acknowledges an event it does not act on without touching the gateway', async ({ service, expect }) => {
    const { session, intent } = await authorizedOrder(service)
    const body = webhookEventBody('payment_intent.processing', { ...intent, status: 'processing' })

    const callsBefore = stripeTest.callSequence().length
    const response = await postWebhook(body, signedHeaders(body))

    // A settling payment is acknowledged so Stripe stops redelivering it, and nothing else. Not
    // even a read: filtering happens before anything is scheduled, so an event type the dashboard
    // has enabled cannot cost a round trip per delivery for the life of the integration.
    expect(response.status).toBe(200)
    expect(stripeTest.callSequence()).toHaveLength(callsBefore)
    expect((await paymentFor(service, session.paymentCollectionId)).capturedAt).toBeNull()
  })

  test('ignores an event from another integration on the same Stripe account', async ({ service, expect }) => {
    const { session, intent } = await authorizedOrder(service)
    const body = webhookEventBody('payment_intent.succeeded', { ...intent, status: 'succeeded', metadata: {} })

    const callsBefore = stripeTest.callSequence().length
    const response = await postWebhook(body, signedHeaders(body))

    expect(response.status).toBe(200)
    expect(stripeTest.callSequence()).toHaveLength(callsBefore)
    expect((await paymentFor(service, session.paymentCollectionId)).capturedAt).toBeNull()
  })
})

/**
 * Stripe emits `payment_intent.succeeded` the moment the browser confirms — typically while the
 * shopper's own checkout is still running — so the subscriber and `complete-cart` reach
 * `authorizePaymentSession` together. Its guard reads the session's payment and then writes one,
 * with nothing atomic between the two, and the unique index on the payment's session id is what
 * makes the residual overlap fail rather than write a second row.
 *
 * What that refusal must not cost is the money. Both callers confirmed the *same* intent, so the
 * loser has no authorization of its own to release.
 */
test.describe('POST /hooks/payment/:provider — losing the race to checkout', () => {
  test('leaves the authorization alone when the payment was already written', async ({ service, expect }) => {
    // Checkout's row, written between this delivery's guard read and its own write. The session
    // sits at `captured` and the row carries no `capturedAt` yet, which is exactly where the
    // winner is between its create and its capture — and the one live state the guard does not
    // treat as terminal, so this delivery goes on to authorize and write.
    const { session, paymentCollectionId, intent, total } = await chargedSessionWithoutPayment(service)
    await service.create.paymentForSession(api.container, {
      paymentCollectionId,
      paymentSessionId: session.id,
      amount: total,
      currencyCode: 'usd',
      providerId: STRIPE_PROVIDER,
      data: { id: intent.id },
    })

    const body = succeededEvent(intent)
    const response = await postWebhook(body, signedHeaders(body))

    // 200: the event was published, and the delivery that failed under it is the transport's to
    // retry. Answering non-2xx would ask Stripe to redeliver work that is already queued, which is
    // a second delivery rather than a retry — and would eventually disable the endpoint.
    expect(response.status).toBe(200)
    // The intent is untouched. Cancelling it here would void the authorization the winner's order
    // was placed against — money lost, on a delivery that changed nothing.
    expect(stripeTest.mock.paymentIntents.cancel).not.toHaveBeenCalled()
    // One payment for the session, still checkout's.
    const collection = await service.read.paymentCollection(api.container, paymentCollectionId)
    expect(collection.payments).toHaveLength(1)
  })
})

/**
 * A gateway failure is now a *subscriber* failure, so what answers it is the transport's bounded
 * retry rather than Stripe's redelivery. The route has already acknowledged by then, which is the
 * whole change: webhook processing survives this process dying, and a failure retries without the
 * gateway having to send the event again.
 */
test.describe('POST /hooks/payment/:provider — a gateway failure', () => {
  test('absorbs a blip, because the adapter rides it out under one idempotency key', async ({ service, expect }) => {
    const { session, intent, total } = await authorizedOrder(service)
    const body = succeededEvent(intent)

    // Down for one attempt. The adapter retries a `retry`-classified error itself, so a single
    // transient failure must not be the end of the capture even before the transport's retry.
    stripeTest.mock.paymentIntents.capture.mockRejectedValueOnce(stripeErrors.connection())

    const response = await postWebhook(body, signedHeaders(body))

    expect(response.status).toBe(200)
    const payment = await paymentFor(service, session.paymentCollectionId)
    expect(payment.captures?.map((capture) => capture.amount.toFixed())).toEqual([total.toFixed()])
  })

  test('is acknowledged even when the adapter cannot ride it out, and takes no money', async ({ service, expect }) => {
    const { session, intent } = await authorizedOrder(service)
    const body = succeededEvent(intent)

    // Three in a row: one per attempt the adapter makes before it gives up, so the outage
    // outlasts it.
    stripeTest.mock.paymentIntents.capture
      .mockRejectedValueOnce(stripeErrors.connection())
      .mockRejectedValueOnce(stripeErrors.connection())
      .mockRejectedValueOnce(stripeErrors.connection())

    const response = await postWebhook(body, signedHeaders(body))

    // 200, because the event reached the transport: a non-2xx would report a delivery failure the
    // route did not have, and the retry that matters is the subscriber's. The suite's in-process
    // adapter has none, so what this pins is the other half — nothing was half-taken. The capture
    // row rolls back with the transaction, so the next attempt finds the authorization as it was.
    expect(response.status).toBe(200)
    const payment = await paymentFor(service, session.paymentCollectionId)
    expect(payment.capturedAt).toBeNull()
    expect(payment.captures ?? []).toEqual([])
  })
})

/**
 * The bug this ticket exists to close: a shopper charged with no order.
 *
 * A payment method that settles asynchronously — a bank redirect, ACH, a card the issuer holds for
 * review — leaves the intent `processing` when the shopper presses Place order. `authorize-payment`
 * correctly refuses, the whole checkout compensates, and then the money arrives. Nothing used to
 * re-run completion, so the charge stood against a cart with no order behind it.
 *
 * Driven through the API harness rather than by calling the subscriber: what has to be true is that
 * a signed webhook, arriving at the real route, ends with an order — every hop in between included.
 */
test.describe('POST /hooks/payment/:provider — a payment that settled after checkout was refused', () => {
  /** A checkout refused with the money already in flight, exactly as `complete-cart` leaves one. */
  async function refusedWhileSettling(service: Fixtures['service'], expect: ExpectStatic) {
    stripeTest.givenIntentStatus('processing')

    const checkout = await service.create.checkoutReadyCart(api.container, {
      cart: { currencyCode: 'usd' },
      payment: { providerId: STRIPE_PROVIDER },
    })
    const session = checkout.paymentSession
    assertDefined(session)

    await expect(completeCartWorkflow.run({ cartId: checkout.cart.id })).rejects.toMatchObject({
      cause: { code: PaymentErrorCodes.AWAITING_AUTHORIZATION },
    })
    expect(await service.read.orders(api.container)).toEqual([])

    const intent = await stripeTest.intentCreatedFor(session.id)
    assertDefined(intent)

    return { ...checkout, session, intent }
  }

  test('ends with one order, one charge, and the same confirmation everyone else gets', async ({ service, expect }) => {
    const { cart, session, intent, total } = await refusedWhileSettling(service, expect)

    // The funds clear. Said to the gateway rather than by mutating the event, because the webhook
    // is not the source of truth about the intent — `authorizePaymentSession` re-reads it, and a
    // `succeeded` event delivered against an intent the fake still answers as `processing` would
    // authorize nothing.
    stripeTest.givenRetrievedStatus('succeeded')

    const body = succeededEvent(intent)
    const response = await postWebhook(body, signedHeaders(body))

    expect(response.status).toBe(200)

    // An order, reached through the link `check-idempotency` reads — the same definition of "an
    // order exists" the workflow itself uses.
    const orderLink = await service.read.linkRepo(api.container, 'orderCart').findByCartId(cart.id)
    expect(orderLink).toMatchObject({ orderId: expect.any(String) })
    expect(await service.read.orders(api.container)).toHaveLength(1)

    // Charged once, for what the cart came to.
    const payment = await paymentFor(service, session.paymentCollectionId)
    expect(payment.captures?.map((capture) => capture.amount.toFixed())).toEqual([total.toFixed()])

    // And the confirmation, with no second code path to keep in step: the re-run publishes
    // `order.placed` from the same final step the synchronous checkout does.
    expect(await service.read.notifications(api.container, { channel: 'email' })).toMatchObject([
      { template: 'order-confirmation', resourceId: orderLink?.orderId },
    ])
  })

  test('makes no second order when the same capture is delivered twice', async ({ service, expect }) => {
    const { cart, intent } = await refusedWhileSettling(service, expect)

    // The funds clear. Said to the gateway rather than by mutating the event, because the webhook
    // is not the source of truth about the intent — `authorizePaymentSession` re-reads it, and a
    // `succeeded` event delivered against an intent the fake still answers as `processing` would
    // authorize nothing.
    stripeTest.givenRetrievedStatus('succeeded')

    const body = succeededEvent(intent)
    const first = await postWebhook(body, signedHeaders(body))
    const second = await postWebhook(body, signedHeaders(body))

    expect([first.status, second.status]).toEqual([200, 200])
    // `check-idempotency` answers the second one with the order the first made. That is why this is
    // a re-run of checkout rather than a completion path of its own — a second path would need a
    // second answer to the same question, and the two would drift.
    expect(await service.read.orders(api.container)).toHaveLength(1)
    expect(await service.read.cart(api.container, cart.id)).toMatchObject({ completedAt: expect.any(Date) })
  })
})

test.describe('webhook amounts', () => {
  /** Runs the adapter the way the route does, but keeps the result the route discards. */
  const readWebhook = (body: string) =>
    paymentModule().getWebhookActionAndData({
      provider: STRIPE_PROVIDER,
      payload: { data: JSON.parse(body) as Record<string, unknown>, rawData: body, headers: signedHeaders(body) },
    })

  test('reports what a completed charge actually took, not the intent total', async ({ service, expect }) => {
    const { intent } = await authorizedOrder(service)

    // 50.00 nominal, 19.99 received. They cannot coincide, so an adapter reading `amount` here
    // reports 50.00 and this assertion is what catches it.
    const body = webhookEventBody('payment_intent.succeeded', {
      ...intent,
      status: 'succeeded',
      amount: 5000,
      // biome-ignore lint/style/useNamingConvention: the Stripe field the adapter reads
      amount_received: 1999,
      // biome-ignore lint/style/useNamingConvention: the Stripe field the adapter reads
      amount_capturable: 0,
    })

    const result = await readWebhook(body)

    expect(result.action).toBe('captured')
    // And in dollars, not cents: the conversion back to the major unit happens at the adapter's
    // edge and nothing above it knows Stripe counts in the smallest one.
    expect(result.data?.amount.toFixed()).toBe('19.99')
  })

  test('reports what an authorization has left to take, not the intent total', async ({ service, expect }) => {
    const { intent } = await authorizedOrder(service)

    const body = webhookEventBody('payment_intent.amount_capturable_updated', {
      ...intent,
      status: 'requires_capture',
      amount: 5000,
      // biome-ignore lint/style/useNamingConvention: the Stripe field the adapter reads
      amount_received: 0,
      // biome-ignore lint/style/useNamingConvention: the Stripe field the adapter reads
      amount_capturable: 2500,
    })

    const result = await readWebhook(body)

    expect(result.action).toBe('authorized')
    expect(result.data?.amount.toFixed()).toBe('25')
  })
})

/**
 * What `stripe-node` raises when it cannot reach Stripe: no `rawType`, only the class — so the
 * class has to be the real one the adapter checks `instanceof` against, which is why it comes
 * through the mocked module rather than being hand-rolled.
 */

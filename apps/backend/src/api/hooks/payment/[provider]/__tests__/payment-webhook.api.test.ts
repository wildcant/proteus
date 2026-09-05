import { BigNumber } from '@core/bignumber.js'
import type { IPaymentModuleService } from '@core/types/index.js'
import type { Logger } from '@core/types/logger.js'
import type { DeferredTasks } from '@core/utils/deferred-tasks.js'
import { ContainerRegistrationKeys, Modules } from '@core/utils/index.js'
import { noopLogger } from '@framework/logger/noop-logger.js'
import { type FakeIntent, signWebhook, stripeGateway, webhookEventBody } from '@tests/mocks/stripe.js'
import type { ApiErrorBody, TestApi } from '@tests/setup/create-api.js'
import type { Fixtures } from '@tests/setup/test-extend.js'
import { test } from '@tests/setup/test-extend.js'
import { assertDefined } from '@tests/utils/assert-defined.js'
import Stripe from 'stripe'
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

/** Everything the deferred runner logged, for the suite that asserts it scheduled nothing. */
const logged: string[] = []
const recordingLogger: Logger = {
  ...noopLogger,
  error(messageOrError) {
    logged.push(typeof messageOrError === 'string' ? messageOrError : messageOrError.message)
  },
}
const testWithLog = test.extend<Pick<Fixtures, 'logger'>>({
  async logger({ task: _ }, use) {
    await use(recordingLogger)
  },
})

/**
 * Processing is deferred, so every assertion about what a webhook *did* has to wait for it.
 * The delay is configured away here rather than slept through; the one test that cares the
 * acknowledgement comes first sets its own.
 */
test.beforeEach(async ({ createApi }) => {
  stripeGateway.reset()
  api = await createApi({
    definitions: hookDefinitions,
    config: { projectConfig: { webhooks: { delayMs: 0, attempts: 3, backoffMs: 0 } } },
  })
})

const processed = (target: TestApi = api) =>
  target.container.resolve<DeferredTasks>(ContainerRegistrationKeys.DEFERRED_TASKS).drain()

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
  const intent = stripeGateway.intentForSession(session.id)
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
  test('captures the authorization in full when the charge succeeds', async ({ service, expect }) => {
    const { session, intent, total } = await authorizedOrder(service)
    const body = succeededEvent(intent)

    // The fixture is deliberately not what `JSON.stringify(req.body)` produces. If the route
    // re-serialised the parsed body the signature below would not verify, which is the whole
    // reason the raw bytes are carried through the request port.
    expect(JSON.stringify(JSON.parse(body))).not.toBe(body)

    const response = await postWebhook(body, signedHeaders(body))
    await processed()

    expect(response.status).toBe(200)

    // A capture takes the whole authorization and nothing about the event's own amount decides
    // it, so the row is the payment's total in major units — dollars, where the intent counts
    // cents. What the event reports is read for the action, not the money.
    const payment = await paymentFor(service, session.paymentCollectionId)
    expect(payment.capturedAt).not.toBeNull()
    expect(payment.captures?.map((capture) => capture.amount.toFixed())).toEqual([total.toFixed()])
  })

  test('captures once when the same event is delivered twice', async ({ service, expect }) => {
    const { session, intent, total } = await authorizedOrder(service)
    const body = succeededEvent(intent)

    const first = await postWebhook(body, signedHeaders(body))
    const second = await postWebhook(body, signedHeaders(body))
    await processed()

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
    await processed()

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
    await processed()
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
    await processed()
    const body = response.body as ApiErrorBody

    expect(response.status).toBe(400)
    expect(body.message).toBe(MISSING_HEADER_REJECTION)
    expect(body.message).not.toBe(SIGNATURE_REJECTION)
    expect((await paymentFor(service, session.paymentCollectionId)).capturedAt).toBeNull()
  })

  test('acknowledges an event it does not act on without touching the gateway', async ({ service, expect }) => {
    const { session, intent } = await authorizedOrder(service)
    const body = webhookEventBody('payment_intent.processing', { ...intent, status: 'processing' })

    const callsBefore = stripeGateway.calls.length
    const response = await postWebhook(body, signedHeaders(body))
    await processed()

    // A settling payment is acknowledged so Stripe stops redelivering it, and nothing else. Not
    // even a read: filtering happens before anything is scheduled, so an event type the dashboard
    // has enabled cannot cost a round trip per delivery for the life of the integration.
    expect(response.status).toBe(200)
    expect(stripeGateway.calls).toHaveLength(callsBefore)
    expect((await paymentFor(service, session.paymentCollectionId)).capturedAt).toBeNull()
  })

  test('ignores an event from another integration on the same Stripe account', async ({ service, expect }) => {
    const { session, intent } = await authorizedOrder(service)
    const body = webhookEventBody('payment_intent.succeeded', { ...intent, status: 'succeeded', metadata: {} })

    const callsBefore = stripeGateway.calls.length
    const response = await postWebhook(body, signedHeaders(body))
    await processed()

    expect(response.status).toBe(200)
    expect(stripeGateway.calls).toHaveLength(callsBefore)
    expect((await paymentFor(service, session.paymentCollectionId)).capturedAt).toBeNull()
  })
})

/**
 * The filtering has to happen *before* the deferral, not inside it. Both orders leave the money
 * alone — a session id we never issued resolves to nothing downstream — so what separates them is
 * the cost: scheduled work that cannot succeed burns its retries and writes a failure into the
 * log for every delivery, of which a busy Stripe account sends a great many.
 */
test.describe('POST /hooks/payment/:provider — filtering happens before scheduling', () => {
  testWithLog(
    'schedules nothing for an event carrying no session id of ours',
    async ({ createApi, service, expect }) => {
      logged.length = 0
      stripeGateway.reset()
      const logging = await createApi({
        definitions: hookDefinitions,
        config: { projectConfig: { webhooks: { delayMs: 0, attempts: 3, backoffMs: 0 } } },
      })
      const checkout = await service.create.order(logging.container, {
        cart: { currencyCode: 'usd' },
        payment: { providerId: STRIPE_PROVIDER },
      })
      assertDefined(checkout.paymentSession)
      const intent = stripeGateway.intentForSession(checkout.paymentSession.id)
      assertDefined(intent)

      const body = webhookEventBody('payment_intent.succeeded', { ...intent, status: 'succeeded', metadata: {} })
      const response = await postWebhook(body, signedHeaders(body), logging)
      await processed(logging)

      expect(response.status).toBe(200)
      expect(logged.filter((line) => line.startsWith('[deferred]'))).toEqual([])
    },
  )
})

test.describe('POST /hooks/payment/:provider — deferral', () => {
  test('answers the gateway before it processes anything', async ({ createApi, service, expect }) => {
    // A real delay this time. A webhook routinely arrives while the shopper's own checkout is
    // still running, and answering first is what keeps the gateway from redelivering into that
    // race — so the acknowledgement must not wait on the work.
    const delayed = await createApi({
      definitions: hookDefinitions,
      config: { projectConfig: { webhooks: { delayMs: 250, attempts: 3, backoffMs: 0 } } },
    })
    const { session, intent } = await authorizedOrder(service)
    const body = succeededEvent(intent)

    const response = await postWebhook(body, signedHeaders(body), delayed)

    expect(response.status).toBe(200)
    expect((await paymentFor(service, session.paymentCollectionId)).capturedAt).toBeNull()

    await processed(delayed)

    expect((await paymentFor(service, session.paymentCollectionId)).capturedAt).not.toBeNull()
  })

  test('retries a deferred failure rather than losing the charge', async ({ service, expect }) => {
    const { session, intent, total } = await authorizedOrder(service)
    const body = succeededEvent(intent)

    // The gateway is down for the first attempt only. Nothing has answered the shopper by this
    // point, so a single transient failure must not be the end of the capture.
    stripeGateway.failNext('paymentIntents.capture', connectionError())

    const response = await postWebhook(body, signedHeaders(body))
    await processed()

    expect(response.status).toBe(200)
    const payment = await paymentFor(service, session.paymentCollectionId)
    expect(payment.captures?.map((capture) => capture.amount.toFixed())).toEqual([total.toFixed()])
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
const connectionError = () => new Stripe.errors.StripeConnectionError({ message: 'socket hang up' })

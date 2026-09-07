import { BigNumber } from '@core/bignumber.js'
import type { IPaymentModuleService } from '@core/types/index.js'
import type { Logger } from '@core/types/logger.js'
import { Modules } from '@core/utils/index.js'
import { noopLogger } from '@framework/logger/noop-logger.js'
import type { StoreCreatePaymentSessionResponse, StoreUpdatePaymentSessionResponse } from '@proteus/http-schemas/store'
import { stripeTest } from '@tests/mocks/vitest/stripe.mock.js'
import { stripeErrors } from '@tests/mocks/vitest/stripe-errors.js'
import type { ApiErrorBody, TestApi } from '@tests/setup/create-api.js'
import type { Fixtures } from '@tests/setup/test-extend.js'
import { test } from '@tests/setup/test-extend.js'
import { vi } from 'vitest'
import paymentCollectionDefinitions from '../definitions.js'

vi.mock('stripe', async () => (await import('@tests/mocks/vitest/stripe.mock.js')).stripeTest.moduleMock())

/** The DI key the Stripe adapter is registered under, which is what the route resolves. */
const STRIPE_PROVIDER = 'pp_stripe_default'

let api: TestApi

/** Everything the adapter logged, for the one suite that asserts on it. */
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

test.beforeEach(async ({ createApi }) => {
  stripeTest.reset()
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

const createSession = <T = StoreCreatePaymentSessionResponse>(collectionId: string, target: TestApi = api) =>
  target.post<T>(`/store/payment-collections/${collectionId}/payment-sessions`, { providerId: STRIPE_PROVIDER })

const updateSession = <T = StoreUpdatePaymentSessionResponse>(
  collectionId: string,
  sessionId: string,
  body: object = {},
  target: TestApi = api,
) => target.patch<T>(`/store/payment-collections/${collectionId}/payment-sessions/${sessionId}`, body)

/** What the gateway was asked to charge, for the single intent these tests create. */
function intentCreateParams() {
  const call = stripeTest.mock.paymentIntents.create.mock.calls[0]
  if (!call) throw new Error('No PaymentIntent was created at the gateway')
  // `paymentIntents.create(params, options)` — the parameters are the first argument.
  return call[0] as Record<string, unknown>
}

/**
 * The idempotency keys each call to a method carried, in order.
 *
 * `create(params, options)` puts them second and `update(id, params, options)` third, so the key is
 * taken from the last argument rather than a fixed index.
 */
const keysTo = (calls: unknown[][]) =>
  calls.map((call) => (call.at(-1) as { idempotencyKey?: string } | undefined)?.idempotencyKey)

const createKeys = () => keysTo(stripeTest.mock.paymentIntents.create.mock.calls)
const updateKeys = () => keysTo(stripeTest.mock.paymentIntents.update.mock.calls)

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

  /**
   * The retry path, at the seam that can see the gateway.
   *
   * Every Place order press comes through this route, so a shopper who is declined and reaches
   * for a second card is retrying. Two intents, only one confirmed, and cart completion
   * authorizing whichever session row came back first is how the shopper ends up holding an
   * authorization against a card that bought nothing.
   */
  test('a second press supersedes the first attempt rather than opening a second one', async ({ service, expect }) => {
    // The state a deferred intent is actually created in: nothing has confirmed it yet. The
    // suite's default is `requires_capture`, which is where a *confirmed* card lands — and a
    // session that has reached that point is money, so it is deliberately not superseded.
    stripeTest.givenIntentStatus('requires_payment_method')
    const collection = await collectionWorth('19.99', 'usd', service)

    const first = await createSession(collection.id)
    const second = await createSession(collection.id)

    // Two intents exist at the gateway — that part is unavoidable, a confirmed intent cannot be
    // reused — but only one session survives, so completion has nothing to pick wrongly between.
    expect(stripeTest.mock.paymentIntents.create).toHaveBeenCalledTimes(2)
    expect(second.body.paymentSession.id).not.toBe(first.body.paymentSession.id)

    const paymentService = api.container.resolve<IPaymentModuleService>(Modules.PAYMENT)
    const after = await paymentService.retrievePaymentCollection(collection.id)
    expect(after.paymentSessions?.map((session) => session.id)).toEqual([second.body.paymentSession.id])
  })

  test('cancels the superseded intent, so three cards leave no authorization standing', async ({ service, expect }) => {
    stripeTest.givenIntentStatus('requires_payment_method')
    const collection = await collectionWorth('19.99', 'usd', service)

    const first = await createSession(collection.id)
    const second = await createSession(collection.id)
    await createSession(collection.id)

    // The abandoned attempts, by id and in order — a hold on a card that bought nothing is the
    // thing being prevented, so it is the intent ids that are asserted rather than a count.
    const cancelled = stripeTest.mock.paymentIntents.cancel.mock.calls.map(([id]) => id)
    expect(cancelled).toEqual([first.body.paymentSession.data.id, second.body.paymentSession.data.id])
  })

  test('reports a processing intent as pending authorization, the same status the webhook path reports', async ({
    service,
    expect,
  }) => {
    // The two paths used to disagree about this one intent state: a session call called it
    // `pending_authorization` while a `payment_intent.processing` webhook called it `pending`.
    // They now read one table, so this status is the webhook action's status too.
    //
    // The shared answer is `pending_authorization` rather than `pending`: an intent the gateway
    // is still settling is money in flight, and calling it `pending` put it in the same bucket as
    // one nobody has confirmed — which is what made cart completion read it as a decline.
    stripeTest.givenIntentStatus('processing')
    const collection = await collectionWorth('19.99', 'usd', service)

    const { body } = await createSession(collection.id)

    expect(body.paymentSession.status).toBe('pending_authorization')
  })

  test('reports a capturable intent as authorized', async ({ service, expect }) => {
    stripeTest.givenIntentStatus('requires_capture')
    const collection = await collectionWorth('19.99', 'usd', service)

    const { body } = await createSession(collection.id)

    expect(body.paymentSession.status).toBe('authorized')
  })
})

test.describe('idempotency keys', () => {
  test('keys the intent to the session row that already exists when the call goes out', async ({ service, expect }) => {
    const collection = await collectionWorth('19.99', 'usd', service)

    const { body } = await createSession(collection.id)

    // Derived from a row in our database, not generated for the call: that is the whole
    // difference between an idempotency key and a request id.
    expect(createKeys()).toEqual([`initiate:${body.paymentSession.id}`])
  })

  test('presents the same key on every attempt of one retried write', async ({ service, expect }) => {
    // The gateway drops the connection once. The adapter retries — which is only safe because the
    // key is unchanged, so Stripe answers the second attempt from the first one's result rather
    // than opening a second intent.
    stripeTest.mock.paymentIntents.create.mockRejectedValueOnce(stripeErrors.connection())
    const collection = await collectionWorth('19.99', 'usd', service)

    const { status, body } = await createSession(collection.id)

    expect(status).toBe(201)
    const keys = createKeys()
    expect(keys).toHaveLength(2)
    expect(new Set(keys)).toEqual(new Set([`initiate:${body.paymentSession.id}`]))
  })

  test('derives the same key after a restart, from the same row', async ({ createApi, service, expect }) => {
    const { cart, collection, session } = await pricedCart(service)

    // The first update dies at the gateway. Nothing about the session row changed, so the retry
    // below is the same logical operation — and a key generated per call would differ.
    stripeTest.mock.paymentIntents.update.mockRejectedValueOnce(stripeErrors.invalidApiKey())
    await service.create.lineItem(api.container, cart.id, { unitPrice: new BigNumber('40.00'), quantity: 1 })
    const failed = await updateSession(collection.id, session.id)

    expect(failed.status).toBe(500)

    // A second process, built from scratch: new container, new provider instance, new module
    // service. Only the database is shared, which is exactly what a restart leaves behind.
    const afterRestart = await createApi({ definitions: paymentCollectionDefinitions })
    const retried = await updateSession(collection.id, session.id, undefined, afterRestart)

    expect(retried.status).toBe(200)
    const keys = updateKeys()
    expect(keys).toHaveLength(2)
    expect(keys[0]).toBe(keys[1])
  })

  test('keys two different updates apart, so the gateway does not read the second as a replay', async ({
    service,
    expect,
  }) => {
    const { cart, collection, session } = await pricedCart(service)

    await service.create.lineItem(api.container, cart.id, { unitPrice: new BigNumber('40.00'), quantity: 1 })
    await updateSession(collection.id, session.id)
    await service.create.lineItem(api.container, cart.id, { unitPrice: new BigNumber('5.00'), quantity: 1 })
    await updateSession(collection.id, session.id)

    // Stripe rejects a key replayed with changed parameters, so two totals must not share one.
    const keys = updateKeys()
    expect(keys).toHaveLength(2)
    expect(keys[0]).not.toBe(keys[1])
  })
})

test.describe('gateway failures', () => {
  test('answers a stale or foreign payment method with 409 and a code', async ({ service, expect }) => {
    stripeTest.mock.paymentIntents.create.mockRejectedValueOnce(stripeErrors.missingPaymentMethod())
    const collection = await collectionWorth('19.99', 'usd', service)

    const { status, body } = await createSession<ApiErrorBody>(collection.id)

    expect(status).toBe(409)
    expect(body.code).toBe('payment_method_unavailable')
    // The id in Stripe's message is a fact about someone's wallet; confirming it to whoever asked
    // is exactly what a probe wants.
    expect(JSON.stringify(body)).not.toContain('pm_1JVFmtGCSCcgOfxvXsBg1Ldu')
  })

  test('answers a transient gateway failure with 503 once the retries are spent', async ({ service, expect }) => {
    stripeTest.mock.paymentIntents.create
      .mockRejectedValueOnce(stripeErrors.connection())
      .mockRejectedValueOnce(stripeErrors.connection())
      .mockRejectedValueOnce(stripeErrors.connection())
    const collection = await collectionWorth('19.99', 'usd', service)

    const { status, body } = await createSession<ApiErrorBody>(collection.id)

    // Not a 500: nothing is wrong with the request, and the caller should try again.
    expect(status).toBe(503)
    expect(body.code).toBe('payment_gateway_unavailable')
    expect(stripeTest.mock.paymentIntents.create).toHaveBeenCalledTimes(3)
  })

  test('answers anything else with 500, and never forwards the gateway message', async ({ service, expect }) => {
    stripeTest.mock.paymentIntents.create.mockRejectedValueOnce(stripeErrors.invalidApiKey())
    const collection = await collectionWorth('19.99', 'usd', service)

    const { status, body } = await createSession<ApiErrorBody>(collection.id)

    expect(status).toBe(500)
    expect(body.code).toBe('payment_gateway_error')
    // The shape of our own secret key, handed to whoever asked for it.
    expect(JSON.stringify(body)).not.toContain('sk_test')
  })
})

/**
 * The log is the other half of "a code, never a message": everything withheld from the response
 * has to be somewhere, or a decline the shopper could only describe vaguely is undiagnosable.
 *
 * The whole container is rebuilt around a logger that keeps what it is told, because the point is
 * that the adapter writes this line on the ordinary failure path — not that a function can format
 * one when called directly.
 */
test.describe('gateway failure logging', () => {
  testWithLog('keeps the type, code, decline code and dashboard link', async ({ createApi, service, expect }) => {
    logged.length = 0
    stripeTest.reset()
    const logging = await createApi({ definitions: paymentCollectionDefinitions })

    const cart = await service.create.cart(logging.container, { currencyCode: 'usd' })
    const { paymentCollection } = await service.create.paymentSessionForCart(logging.container, {
      cartId: cart.id,
      amount: new BigNumber('19.99'),
      currencyCode: 'usd',
    })
    stripeTest.mock.paymentIntents.create.mockRejectedValueOnce(stripeErrors.missingPaymentMethod())

    await createSession(paymentCollection.id, logging)

    const failure = logged.find((line) => line.includes('initiatePayment failed'))
    expect(failure).toBeDefined()
    expect(failure).toContain('type=invalid_request_error')
    expect(failure).toContain('code=resource_missing')
    expect(failure).toContain('decline_code=none')
    expect(failure).toContain('request_log_url=https://dashboard.stripe.com/test/logs/req_missing')
  })
})

test.describe('PATCH /store/payment-collections/:id/payment-sessions/:sessionId', () => {
  test('re-prices the session from the cart total the server computed', async ({ service, expect }) => {
    const { cart, collection, session } = await pricedCart(service)

    await service.create.lineItem(api.container, cart.id, { unitPrice: new BigNumber('40.00'), quantity: 1 })

    const { status, body } = await updateSession(collection.id, session.id)

    expect(status).toBe(200)
    expect(body.paymentSession.amount).toBe('59.99')
    expect(stripeTest.mock.paymentIntents.update.mock.calls[0]?.[1]).toMatchObject({ amount: 5999, currency: 'usd' })
  })

  test('ignores an amount the browser sent anyway', async ({ service, expect }) => {
    const { cart, collection, session } = await pricedCart(service)

    await service.create.lineItem(api.container, cart.id, { unitPrice: new BigNumber('40.00'), quantity: 1 })

    const { body } = await updateSession(collection.id, session.id, { amount: '1.00' })

    // The one number a shopper must never be able to choose.
    expect(body.paymentSession.amount).toBe('59.99')
    expect(stripeTest.mock.paymentIntents.update.mock.calls[0]?.[1]).toMatchObject({ amount: 5999 })
  })

  test('does not touch the gateway when the total has not moved', async ({ service, expect }) => {
    const { collection, session } = await pricedCart(service)

    const { status } = await updateSession(collection.id, session.id)

    expect(status).toBe(200)
    expect(stripeTest.mock.paymentIntents.update).not.toHaveBeenCalled()
  })

  test('returns the whole provider blob, so the storefront keeps its client secret', async ({ service, expect }) => {
    const { cart, collection, session } = await pricedCart(service)
    const secretBefore = session.data.clientSecret

    await service.create.lineItem(api.container, cart.id, { unitPrice: new BigNumber('40.00'), quantity: 1 })
    const { body } = await updateSession(collection.id, session.id)

    // A partial blob strands a storefront mid-checkout with nothing to confirm against.
    expect(secretBefore).toBeTruthy()
    expect(body.paymentSession.data.clientSecret).toBe(secretBefore)
  })

  test('refuses a session that belongs to another payment collection', async ({ service, expect }) => {
    const mine = await pricedCart(service)
    const theirs = await pricedCart(service)

    const { status } = await updateSession(mine.collection.id, theirs.session.id)

    expect(status).toBe(404)
    expect(stripeTest.mock.paymentIntents.update).not.toHaveBeenCalled()
  })
})

/** A cart with one 19.99 item, its collection, and a Stripe session opened at that total. */
async function pricedCart(service: Fixtures['service']) {
  const cart = await service.create.cart(api.container, { currencyCode: 'usd' })
  await service.create.lineItem(api.container, cart.id, { unitPrice: new BigNumber('19.99'), quantity: 1 })

  const { paymentCollection } = await service.create.paymentSessionForCart(api.container, {
    cartId: cart.id,
    amount: new BigNumber('19.99'),
    currencyCode: 'usd',
  })

  const { body } = await createSession(paymentCollection.id)
  return { cart, collection: paymentCollection, session: body.paymentSession }
}

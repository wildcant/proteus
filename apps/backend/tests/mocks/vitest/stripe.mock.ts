import { vi } from 'vitest'
import {
  gatewayCustomerId,
  gatewayIntentId,
  type IntentStatus,
  type StripeCard,
  stripeFactories,
} from '../stripe-factories.js'

/**
 * The Stripe SDK as plain vitest mocks.
 *
 * The e2e server has to fake Stripe at the wire, because it runs the real backend in another
 * process (`tests/mocks/msw/`). The vitest suites have a module seam available, so they take it:
 * every SDK method is a `vi.fn`, which means a test asserts with `toHaveBeenCalledWith` and
 * arranges an answer with `mockResolvedValue` / `mockRejectedValueOnce` — nothing to learn that
 * vitest does not already do.
 *
 * **Stateless.** This module holds no mutable state at all: every default answers purely from the
 * arguments it was handed, so nothing carries between calls, tests or files. A test that needs the
 * gateway to hold something — a wallet, a confirmed intent — arranges it on the mock it cares
 * about, with values it owns. That is the whole contract; there is no store to reason about.
 *
 * `webhooks` is deliberately the real implementation: signature verification is the thing under
 * test in the webhook suite, not a stub.
 */

type Params = Record<string, unknown>

const metadataOf = (params: Params) => (params.metadata ?? {}) as Record<string, string>

/**
 * Derived, not stored, so ids stay distinct and say which session or customer they belong to. The
 * shapes come from `stripe-factories.ts`, which is also where the wire fake gets them — the two
 * have to mint the same id for the same request or a test cannot move between them.
 */
const intentIdFor = (params: Params) => gatewayIntentId(String(metadataOf(params).sessionId ?? 'mock'))
const customerIdFor = (params: Params) => gatewayCustomerId(String(metadataOf(params).customerId ?? 'mock'))

/** An intent built purely from what the caller asked for, in whatever state is wanted. */
const intentFrom = (params: Params, status: IntentStatus) =>
  stripeFactories.paymentIntent({
    id: intentIdFor(params),
    status,
    amount: Number(params.amount),
    currency: String(params.currency ?? 'usd'),
    captureMethod: String(params.capture_method ?? 'manual'),
    metadata: metadataOf(params),
    ...(params.customer ? { customer: String(params.customer) } : {}),
    ...(params.setup_future_usage ? { setupFutureUsage: String(params.setup_future_usage) } : {}),
    ...(params.payment_method ? { paymentMethod: String(params.payment_method) } : {}),
  })

const mock = {
  paymentIntents: {
    create: vi.fn(),
    retrieve: vi.fn(),
    capture: vi.fn(),
    cancel: vi.fn(),
    update: vi.fn(),
  },
  customers: {
    create: vi.fn(),
    retrieve: vi.fn(),
    update: vi.fn(),
    del: vi.fn(),
    listPaymentMethods: vi.fn(),
    retrievePaymentMethod: vi.fn(),
  },
  paymentMethods: {
    update: vi.fn(),
    detach: vi.fn(),
  },
  refunds: {
    create: vi.fn(),
  },
}

export const stripeTest = {
  /** The SDK surface. Assert on these: `expect(stripeTest.mock.refunds.create).toHaveBeenCalled()`. */
  mock,

  /**
   * Puts every mock back to a default that answers from its own arguments, and forgets what it was
   * called with. Call it in `beforeEach`.
   *
   * `requires_capture` is where most of these tests start: what a manual-capture intent reaches
   * once the shopper has confirmed it. A test that needs anything else — another status, a wallet
   * with cards in it, a refusal — says so on the one method it cares about.
   */
  reset(): void {
    for (const group of Object.values(mock)) {
      for (const fn of Object.values(group)) fn.mockReset()
    }

    mock.paymentIntents.create.mockImplementation(async (params: Params) => intentFrom(params, 'requires_capture'))
    mock.paymentIntents.retrieve.mockImplementation(async (id: string) =>
      stripeFactories.paymentIntent({ id, status: 'requires_capture' }),
    )
    mock.paymentIntents.capture.mockImplementation(async (id: string) =>
      stripeFactories.paymentIntent({ id, status: 'succeeded' }),
    )
    mock.paymentIntents.cancel.mockImplementation(async (id: string) =>
      stripeFactories.paymentIntent({ id, status: 'canceled' }),
    )
    mock.paymentIntents.update.mockImplementation(async (id: string, params: Params) =>
      stripeFactories.paymentIntent({
        id,
        status: 'requires_capture',
        ...(params.amount ? { amount: Number(params.amount) } : {}),
        ...(params.currency ? { currency: String(params.currency) } : {}),
      }),
    )

    mock.customers.create.mockImplementation(async (params: Params) =>
      stripeFactories.customer({
        id: customerIdFor(params),
        metadata: metadataOf(params),
        ...(params.email ? { email: String(params.email) } : {}),
        ...(params.name ? { name: String(params.name) } : {}),
      }),
    )
    mock.customers.retrieve.mockImplementation(async (id: string) => stripeFactories.customer({ id }))
    // Echoes the nomination back, which is what Stripe answers. A test that then reads the customer
    // arranges `customers.retrieve` itself.
    mock.customers.update.mockImplementation(
      // biome-ignore lint/style/useNamingConvention: the raw Stripe wire field name
      async (id: string, params?: { invoice_settings?: { default_payment_method?: string } }) =>
        stripeFactories.customer({
          id,
          defaultPaymentMethod: params?.invoice_settings?.default_payment_method ?? null,
        }),
    )
    mock.customers.del.mockImplementation(async (id: string) => stripeFactories.deletedCustomer(id))

    // Empty, because a wallet has cards only when a test says so.
    mock.customers.listPaymentMethods.mockResolvedValue(stripeFactories.list([]))
    mock.customers.retrievePaymentMethod.mockImplementation(async (customer: string, id: string) =>
      stripeFactories.paymentMethod({ id, customer }),
    )

    mock.paymentMethods.update.mockImplementation(async (id: string) => stripeFactories.paymentMethod({ id }))
    mock.paymentMethods.detach.mockImplementation(async (id: string) =>
      stripeFactories.paymentMethod({ id, customer: null }),
    )

    mock.refunds.create.mockImplementation(async (params: Params) =>
      stripeFactories.refund({ ...(params.amount ? { amount: String(params.amount) } : {}) }),
    )
  },

  /**
   * Makes both `create` and `retrieve` answer with a status.
   *
   * The two are independent mocks, but a test that says "the intent is succeeded" means it for the
   * whole flow — the adapter creates an intent and then retrieves it to authorize.
   */
  givenIntentStatus(status: IntentStatus): void {
    mock.paymentIntents.create.mockImplementation(async (params: Params) => intentFrom(params, status))
    mock.paymentIntents.retrieve.mockImplementation(async (id: string) => stripeFactories.paymentIntent({ id, status }))
  },

  /** Makes `retrieve` answer with a status, the way something outside this process would. */
  givenRetrievedStatus(status: IntentStatus): void {
    mock.paymentIntents.retrieve.mockImplementation(async (id: string) => stripeFactories.paymentIntent({ id, status }))
  },

  /**
   * Makes the wallet read answer with exactly these cards, filtered and ordered the way Stripe's
   * customer-scoped listing does.
   *
   * The cards are the argument, closed over by the implementation this installs — calling it again
   * replaces the answer outright, so there is nothing accumulating anywhere. Both halves of the
   * filtering matter: without `allow_redisplay` the listing returns cards the shopper never
   * consented to see again, and without the ordering the route's own sort would look correct
   * whatever it did.
   *
   * Only the listing. A refused ownership check is arranged by the test that wants one, with a
   * real `Stripe.errors` instance, so the adapter's classification runs against the shape it sees.
   */
  givenWallet(cards: StripeCard[]): void {
    mock.customers.listPaymentMethods.mockImplementation(
      // biome-ignore lint/style/useNamingConvention: the raw Stripe wire field name
      async (customerId: string, params?: { allow_redisplay?: string; limit?: number }) => {
        const owned = cards
          .filter((card) => card.customer === customerId)
          .filter((card) => !params?.allow_redisplay || card.allow_redisplay === params.allow_redisplay)
          .sort((a, b) => b.created - a.created)

        return stripeFactories.list(params?.limit ? owned.slice(0, params.limit) : owned)
      },
    )
  },

  /**
   * The gateway customer id the adapter will mint for a Proteus customer.
   *
   * Derived rather than looked up: `customers.create` builds the id from the metadata the adapter
   * writes, so a test can name the id before the call that creates it.
   */
  gatewayCustomerIdFor(proteusCustomerId: string): string {
    return gatewayCustomerId(proteusCustomerId)
  },

  /**
   * The parameters an intent was created with.
   *
   * `at` is an array index, so the default reads the first call and `-1` reads the most recent —
   * which is what a flow that supersedes one session with another needs. `create(params, options)`
   * puts the parameters first.
   */
  intentCreateParams(at = 0): Record<string, unknown> {
    const call = mock.paymentIntents.create.mock.calls.at(at)
    if (!call) throw new Error('No PaymentIntent was created at the gateway')
    return call[0] as Record<string, unknown>
  },

  /**
   * The intent the adapter opened for a payment session — what `paymentIntents.create` actually
   * answered, found through the metadata the adapter writes.
   *
   * Read back off the mock rather than stored, so it is the same object the code under test saw.
   */
  async intentCreatedFor(sessionId: string) {
    const index = mock.paymentIntents.create.mock.calls.findIndex(
      ([params]) => (params as { metadata?: Record<string, string> })?.metadata?.sessionId === sessionId,
    )
    if (index === -1) return undefined

    const result = mock.paymentIntents.create.mock.results[index]
    return result?.type === 'return' ? await result.value : undefined
  },

  /**
   * Every SDK call made so far, in order, as `group.method` names.
   *
   * Each `vi.fn` records only its own calls, but `invocationCallOrder` is a process-wide counter,
   * so merging on it reconstructs the sequence across methods — which is what a test asserting
   * "the write went first and the status was read only because it was refused" needs.
   */
  callSequence(): string[] {
    const calls: Array<{ order: number; name: string }> = []

    for (const [group, methods] of Object.entries(mock)) {
      for (const [method, fn] of Object.entries(methods)) {
        for (const order of fn.mock.invocationCallOrder) calls.push({ order, name: `${group}.${method}` })
      }
    }

    return calls.sort((a, b) => a.order - b.order).map((call) => call.name)
  },

  /**
   * The module factory. Test files register it with:
   *
   * ```ts
   * vi.mock('stripe', async () => (await import('@tests/mocks/vitest/stripe.mock.js')).stripeTest.moduleMock())
   * ```
   */
  async moduleMock() {
    const actual = await vi.importActual<typeof import('stripe')>('stripe')
    const ActualStripe = actual.default

    stripeTest.reset()

    class FakeStripe {
      static errors = ActualStripe.errors

      /**
       * The adapter asks for the fetch client explicitly, because the default one does not exist
       * on workerd. Nothing here makes an HTTP call, so this only has to answer the question.
       */
      static createFetchHttpClient = ActualStripe.createFetchHttpClient

      /** Stripe's real webhook helper — verification is the thing under test, not a stub. */
      webhooks = new ActualStripe('sk_test_fake').webhooks

      paymentIntents = mock.paymentIntents
      customers = mock.customers
      paymentMethods = mock.paymentMethods
      refunds = mock.refunds
    }

    return { ...actual, default: FakeStripe }
  },
}

import { buildEvent, type PaymentCapturedAction } from '@core/event-bus/events.js'
import { defineSubscriber } from '@core/event-bus/types.js'
import type { IOrderModuleService } from '@core/types/order/service.js'
import type { IPaymentModuleService } from '@core/types/payment/service.js'
import { Modules } from '@core/utils/modules-definition.js'
import type { TestContainer } from '@tests/setup/create-container.js'
import { type Fixtures, test } from '@tests/setup/test-extend.js'
import { assertDefined } from '@tests/utils/assert-defined.js'
import { vi } from 'vitest'
import { config } from '../process-payment-captured.js'

/**
 * The subscriber on its own — what one delivery does, separately from the route publishing it.
 * `src/api/hooks/payment/[provider]/__tests__/payment-webhook.api.test.ts` covers the other half:
 * that a signed webhook reaches this at all, and what a shopper ends up with when it does.
 *
 * The handler is called directly rather than through a bus, because what is under test is the
 * handler. Which adapter would have carried the event, and whether it retries, is the transport's
 * and is asserted where the transport is.
 *
 * The `system` provider does the paying, so no gateway is mocked: it authorizes and captures for
 * real, which is what makes the assertions below about payments rather than about spies.
 */

let container: TestContainer

test.beforeEach(async ({ createTestContainer }) => {
  container = await createTestContainer()
})

/** One delivery, identical to what an adapter would hand the handler. */
function deliver(sessionId: string, action: PaymentCapturedAction = 'captured'): Promise<void> {
  return defineSubscriber(config).handler({
    event: buildEvent('payment.captured', { id: sessionId, action }, config.name),
    container,
  })
}

/**
 * A checkout whose payment settled after the shopper was refused: the cart is ready, nothing has
 * completed it, and the session is waiting to be authorized.
 *
 * The refusal itself is `complete-cart`'s and is asserted there. What matters here is the state it
 * leaves — an un-completed cart with a payable session — which is byte-identical to a checkout that
 * was never attempted, because the compensation clears `completedAt` and dismisses the links.
 */
async function settledAfterRefusal(service: Fixtures['service']) {
  const checkout = await service.create.checkoutReadyCart(container)
  const session = checkout.paymentSession
  assertDefined(session)
  return { ...checkout, session }
}

const paymentModule = () => container.resolve<IPaymentModuleService>(Modules.PAYMENT)

/**
 * Breaks the re-run at `create-order`, which is *before* `authorize-payment`.
 *
 * That is the half of the alert's job the wording has to be right about: nothing compensates a
 * payment the workflow never reached, so what the alert reports is the state the subscriber left
 * the payment in rather than anything the workflow did to it.
 */
function failTheReRun() {
  vi.spyOn(container.resolve<IOrderModuleService>(Modules.ORDER), 'createOrder').mockRejectedValueOnce(
    new Error('order module unavailable'),
  )
}

test.describe('the payment.captured subscriber', () => {
  /**
   * The headline: money that arrives after the checkout was refused ends with an order.
   *
   * The confirmation comes with it and has no code of its own here — the re-run publishes
   * `order.placed` from checkout's final step, so the async path picks up exactly the subscriber the
   * synchronous one does.
   */
  test('finishes the checkout the captured payment belongs to', async ({ service, expect }) => {
    const { cart, session } = await settledAfterRefusal(service)

    await deliver(session.id)

    const orderLink = await service.read.linkRepo(container, 'orderCart').findByCartId(cart.id)
    expect(orderLink).toMatchObject({ orderId: expect.any(String) })
    expect(await service.read.cart(container, cart.id)).toMatchObject({ completedAt: expect.any(Date) })
    expect(await service.read.notifications(container, { channel: 'email' })).toMatchObject([
      { template: 'order-confirmation', resourceId: orderLink?.orderId },
    ])
  })

  /**
   * Not advice — the contract. The weaker of the two transports is at-least-once with no dedup, and
   * Stripe redelivers an event until it is acknowledged, so a second delivery is a thing that
   * happens rather than a thing that goes wrong.
   *
   * Both halves have to hold it: `check-idempotency` answers with the order the first delivery made,
   * and `capturedAt` is what stops the money being taken a second time.
   */
  test('makes no second order and takes no second capture when delivered twice', async ({ service, expect }) => {
    const { session } = await settledAfterRefusal(service)

    await deliver(session.id)
    await deliver(session.id)

    expect(await service.read.orders(container)).toHaveLength(1)
    const collection = await service.read.paymentCollection(container, session.paymentCollectionId)
    expect(collection.payments).toHaveLength(1)
    expect(collection.payments?.[0]?.captures).toHaveLength(1)
  })

  /**
   * Convergence, not a guess.
   *
   * Our own read disagreeing with the event — the provider says the money moved, the session says
   * it is still settling — is a gateway that has not caught up with itself, and it resolves on its
   * own. Failing is what lets the bounded retry back off and read again; a delay would be the same
   * wait with a duration invented for it, and would degrade exactly under the load that widens the
   * window.
   */
  test('fails rather than acting on a session that is still settling', async ({ service, expect }) => {
    const { session } = await settledAfterRefusal(service)
    vi.spyOn(paymentModule(), 'authorizePaymentSession').mockResolvedValueOnce({ outcome: 'pending_authorization' })

    await expect(deliver(session.id)).rejects.toThrow(/still settling/)

    expect(await service.read.orders(container)).toEqual([])
  })

  /**
   * The provider has decided, and the answer was no. A retry would ask the same question and get
   * the same answer, so the delivery is finished with — and there is no money to build an order on.
   */
  test('does nothing for a session the provider refused', async ({ service, expect }) => {
    const { session } = await settledAfterRefusal(service)
    vi.spyOn(paymentModule(), 'authorizePaymentSession').mockResolvedValueOnce({
      outcome: 'not_authorized',
      sessionStatus: 'error',
    })

    await expect(deliver(session.id)).resolves.toBeUndefined()

    expect(await service.read.orders(container)).toEqual([])
    expect(await service.read.notifications(container)).toEqual([])
  })

  /**
   * The outcome an operator has to hear about, and the reason it cannot be `complete-cart`'s own
   * compensation alert.
   *
   * That alert is keyed `checkout-failed:<cartId>`, and on this path the checkout workflow runs
   * twice for the same cart — the first attempt, the one that refused the still-settling payment,
   * has already written that key. A second compensation on the same cart is deduped, so the operator
   * would hear nothing at all. It also reports a rollback rather than money taken, which is the
   * opposite of what happened.
   *
   * So both rows exist here, under different keys, saying different things.
   */
  test('raises its own alert when the re-run cannot produce an order', async ({ service, expect }) => {
    const { cart, session } = await settledAfterRefusal(service)
    failTheReRun()

    await expect(deliver(session.id)).rejects.toThrow('order module unavailable')

    expect(await service.read.orders(container)).toEqual([])
    const alerts = await service.read.notifications(container, { channel: 'feed' })
    expect(alerts.map((alert) => alert.template).sort()).toEqual(['checkout-failed', 'payment-without-order'])

    // What the new one says, which is the half the existing alert gets wrong: money moved. Reported
    // as observed rather than promised — `authorize-payment`'s compensation refunds a re-run that
    // got that far, and this one failed before it, so the capture is still standing.
    expect(alerts.find((alert) => alert.template === 'payment-without-order')).toMatchObject({
      channel: 'feed',
      resourceType: 'cart',
      resourceId: cart.id,
      data: {
        title: 'Payment captured, no order',
        description: expect.stringContaining('is captured and has not been refunded'),
      },
    })
  })

  /**
   * The wording on the delivery that actually reaches this in production.
   *
   * The Stripe adapter opens every intent with `capture_method: 'manual'`, so a confirmed card lands
   * on `requires_capture` → `authorized`, and `payment_intent.amount_capturable_updated` is the
   * ordinary first webhook of a card checkout. The completion re-run is not gated on the action, so
   * that delivery reaches the alert as often as any other — and the money it describes is *held*,
   * not taken. Telling an operator a shopper was charged sends them looking for a refund to issue
   * that does not exist.
   */
  test('says the funds are held, not taken, when the delivery only authorized', async ({ service, expect }) => {
    const { cart, session } = await settledAfterRefusal(service)
    failTheReRun()

    await expect(deliver(session.id, 'authorized')).rejects.toThrow('order module unavailable')

    // The premise: nothing was captured, because the action was not a capture.
    const collection = await service.read.paymentCollection(container, session.paymentCollectionId)
    expect(collection.payments?.[0]).toMatchObject({ capturedAt: null })

    const alerts = await service.read.notifications(container, { channel: 'feed' })
    expect(alerts.find((alert) => alert.template === 'payment-without-order')).toMatchObject({
      resourceId: cart.id,
      data: {
        title: 'Payment authorized, no order',
        description: expect.stringContaining('held at the provider, not taken'),
      },
    })
  })

  /**
   * The other run got there first — the shopper's own request, or a concurrent delivery — and that
   * is not a shopper charged for nothing. Nothing is raised, and the throw is what lets the bounded
   * retry converge on the order that run is creating.
   */
  test('stays quiet when another completion already owns the cart', async ({ service, expect }) => {
    const { cart, session } = await settledAfterRefusal(service)

    // The state a completion in flight leaves: its `orderCart` link written, `completedAt` not yet
    // stamped. `check-idempotency` reads exactly that and refuses a second run.
    const orderService = container.resolve<IOrderModuleService>(Modules.ORDER)
    const order = await orderService.createOrder({ email: cart.email ?? 'shopper@example.com', currencyCode: 'usd' })
    await service.read.linkRepo(container, 'orderCart').create({ orderId: order.id, cartId: cart.id })

    await expect(deliver(session.id)).rejects.toThrow(/already being completed/)

    expect(await service.read.notifications(container, { channel: 'feed' })).toEqual([])
  })
})

import { buildEvent } from '@core/event-bus/events.js'
import { defineSubscriber } from '@core/event-bus/types.js'
import type { NotificationDTO } from '@core/types/notification/common.js'
import type { INotificationModuleService } from '@core/types/notification/service.js'
import type { IOrderModuleService } from '@core/types/order/service.js'
import { Modules } from '@core/utils/index.js'
import type { TestContainer } from '@tests/setup/create-container.js'
import { type Fixtures, test } from '@tests/setup/test-extend.js'
import { vi } from 'vitest'
import { config } from '../send-order-confirmation.js'

/**
 * The subscriber on its own — what it does with one delivery, separately from checkout publishing
 * it. `__tests__/complete-cart.test.ts` covers the other half: that checkout publishes at all, and
 * publishes nothing when it unwinds.
 *
 * The handler is called directly rather than through a bus, because what is under test is the
 * handler. Which adapter would have carried the event, and whether it retries, is the transport's
 * and is asserted where the transport is.
 */

let container: TestContainer

test.beforeEach(async ({ createTestContainer }) => {
  container = await createTestContainer()
})

/**
 * One delivery of `order.placed`, identical to what an adapter would hand the handler.
 *
 * Through `defineSubscriber`, for the reason the generated registry calls it: that is what erases
 * the config's event type argument, and the erased handler is what every adapter actually invokes.
 */
function deliver(orderId: string): Promise<void> {
  return defineSubscriber(config).handler({
    event: buildEvent('order.placed', { id: orderId }, config.name),
    container,
  })
}

/**
 * An order with everything the confirmation reads — line items, a shipping method, a captured
 * transaction and a shipping address — and no notification against it yet.
 *
 * Built through the order module rather than by completing a cart, which is what `service.create
 * .order` does: that runs the checkout workflow, which now publishes `order.placed` itself, so
 * every assertion here would be about a confirmation this test did not send.
 */
async function orderAwaitingItsConfirmation(dto: Fixtures['dto']) {
  const orderService = container.resolve<IOrderModuleService>(Modules.ORDER)

  const order = await orderService.createOrder(
    dto.generate.createOrder({
      email: 'shopper@example.com',
      items: [dto.generate.createOrderLineItem()],
      shippingMethods: [dto.generate.createOrderShippingMethod()],
      shippingAddress: dto.generate.createOrderAddress(),
    }),
  )
  await orderService.addOrderTransaction(dto.generate.createOrderTransaction({ orderId: order.id }))

  return order
}

/**
 * What the notification module answers with when a provider refuses a send: a persisted row saying
 * `failure`, never a rejected promise. Standing the module up with a real failing email provider
 * would mean a provider row and a DI registration to assert one branch — the module's own tests
 * (`modules/notification/__tests__`) already cover that this shape is the one it produces.
 */
function refusedByProvider(notification: NotificationDTO): NotificationDTO {
  return { ...notification, status: 'failure', providerId: 'np_email_default' }
}

test.describe('the order confirmation subscriber', () => {
  test('builds the confirmation from the order the event names', async ({ dto, service, expect }) => {
    const order = await orderAwaitingItsConfirmation(dto)

    await deliver(order.id)

    expect(await service.read.notifications(container)).toMatchObject([
      {
        to: order.email,
        channel: 'email',
        template: 'order-confirmation',
        triggerType: 'order.placed',
        resourceType: 'order',
        resourceId: order.id,
      },
    ])
  })

  /**
   * The reason this runs in a subscriber at all.
   *
   * Inside checkout the send could not be allowed to fail — the payment is authorized by then — so
   * every failure was swallowed and nothing retried it without re-running the whole checkout. Here
   * the throw is the retry: it is what the transport counts attempts against, and what leaves a
   * failed activity execution or a dead-letter message behind once the budget is spent.
   */
  test('throws when the provider refuses the send, so the transport retries it', async ({ dto, service, expect }) => {
    const order = await orderAwaitingItsConfirmation(dto)
    const notificationService = container.resolve<INotificationModuleService>(Modules.NOTIFICATION)
    const create = notificationService.createNotification.bind(notificationService)
    vi.spyOn(notificationService, 'createNotification').mockImplementationOnce(async (data, context) =>
      refusedByProvider(await create(data, context)),
    )

    await expect(deliver(order.id)).rejects.toThrow(/was not sent/)

    // Swallowed is the one thing it must not be: the row stays as the record of the attempt.
    expect(await service.read.notifications(container)).toMatchObject([{ resourceId: order.id }])
  })

  /**
   * The other way a row says `failure`, and deliberately not a retry.
   *
   * No provider is configured for the channel, so every attempt fails identically until someone
   * changes configuration — burning the retry budget produces five more of the same row and no
   * email. The backend test environment is exactly this deployment, which is why it is worth
   * pinning rather than assuming: it registers a `feed` provider and no `email` one.
   */
  test('does not retry a channel with no provider configured', async ({ dto, service, expect }) => {
    const order = await orderAwaitingItsConfirmation(dto)

    await expect(deliver(order.id)).resolves.toBeUndefined()

    expect(await service.read.notifications(container)).toMatchObject([
      { resourceId: order.id, status: 'failure', providerId: null },
    ])
  })

  /**
   * Not advice — the contract. The weaker of the two transports is at-least-once with no dedup, so
   * a second delivery of one event is a thing that happens rather than a thing that goes wrong.
   *
   * The guard is the builder's `idempotencyKey`, derived from the order id like everything else
   * here, so the repeat finds the row the first delivery wrote instead of writing another.
   */
  test('sends once when the same event is delivered twice', async ({ dto, service, expect }) => {
    const order = await orderAwaitingItsConfirmation(dto)

    await deliver(order.id)
    await deliver(order.id)

    expect(await service.read.notifications(container)).toHaveLength(1)
  })
})

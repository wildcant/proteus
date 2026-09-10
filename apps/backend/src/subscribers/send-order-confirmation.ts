import { AppError, ErrorTypes } from '@core/errors/app-error.js'
import type { SubscriberArgs, SubscriberConfig } from '@core/event-bus/types.js'
import type { Logger } from '@core/types/logger.js'
import type { INotificationModuleService } from '@core/types/notification/service.js'
import type { IOrderModuleService } from '@core/types/order/service.js'
import { ContainerRegistrationKeys, Modules } from '@core/utils/index.js'
import { env } from '@env'
import { buildOrderConfirmationNotification } from '@workflows/notification/utils/order-confirmation.js'

/**
 * The shopper's order confirmation, sent after checkout rather than inside it.
 *
 * This is the whole point of the bus for a shopper: the send used to be checkout's last step, so a
 * slow mail provider was time the shopper spent watching a spinner and a failed send was a failure
 * nothing could retry without re-running the checkout. Here the send is its own unit of work with
 * its own bounded retry, and checkout returns as soon as the order exists.
 *
 * ## Why it throws
 *
 * The notification module records the outcome on the row instead of raising: a provider that
 * refuses the send comes back as `status: 'failure'`, not as a rejected promise. Rethrowing is
 * therefore the only thing that makes the failure visible to the transport, and the transport's
 * retry is the machinery this ticket exists to reach — a Temporal activity retried under its
 * bounded policy on node, a redelivered queue message on workerd. What still fails after that
 * budget stays where an operator can read it: a failed activity execution in the Temporal UI, a
 * message in `proteus-events-dlq`, and either way the notification row itself, which carries the
 * failure and the address it was for.
 *
 * A `providerId` of null is the other way a row can say `failure`, and it is deliberately **not**
 * rethrown: it means no provider is configured for the channel, so every attempt fails identically
 * until someone changes configuration. Retrying that is five more of the same log line; the row is
 * the record, and a deployment with no email provider is a choice rather than an outage.
 *
 * ## Why it is safe to run twice
 *
 * Required to be — the weaker transport is at-least-once with no dedup. Both halves of that are
 * derived from the order id and from nothing minted here: the dispatch identity through the event's
 * payload, and the notification's own `idempotencyKey` inside the builder. A repeat delivery of a
 * confirmation that already sent finds the existing row and returns it unsent.
 */
async function sendOrderConfirmation({ event, container }: SubscriberArgs<'order.placed'>) {
  const notificationService = container.resolve<INotificationModuleService>(Modules.NOTIFICATION)
  const orderService = container.resolve<IOrderModuleService>(Modules.ORDER)
  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER)
  const orderId = event.data.id

  // The event carries an id, never a DTO, so the confirmation is built from the order as it is now
  // rather than as it was when checkout published — which is what makes a late delivery correct.
  const order = await orderService.retrieveOrder(orderId)
  const [lineItems, shippingMethods, transactions, shippingAddress] = await Promise.all([
    orderService.listOrderLineItems({ orderId: order.id }),
    orderService.listOrderShippingMethods({ orderId: order.id }),
    orderService.listOrderTransactions({ orderId: order.id }),
    orderService.retrieveOrderAddress(order.id, 'shipping'),
  ])

  const notification = await notificationService.createNotification(
    buildOrderConfirmationNotification({
      order,
      lineItems: orderService.enrichLineItems(lineItems),
      totals: orderService.computeOrderTotals({ lineItems, shippingMethods, transactions }),
      shippingAddress,
      storeUrl: env.STORE_URL,
    }),
  )

  logger.info(
    `[send-order-confirmation] Notification "${notification.id}" for order "${orderId}" is "${notification.status}" via provider "${notification.providerId ?? 'none'}"`,
  )

  if (notification.status === 'failure' && notification.providerId) {
    throw new AppError({
      type: ErrorTypes.SERVICE_UNAVAILABLE,
      message: `The order confirmation for order "${orderId}" was not sent — provider "${notification.providerId}" refused it`,
    })
  }

  if (notification.status === 'failure') {
    logger.error(
      `[send-order-confirmation] No provider configured for the "${notification.channel}" channel, so order "${orderId}" was not sent; not retrying`,
    )
  }
}

export const config: SubscriberConfig<'order.placed'> = {
  name: 'send-order-confirmation',
  event: 'order.placed',
  handler: sendOrderConfirmation,
}

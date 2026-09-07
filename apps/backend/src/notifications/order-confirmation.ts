import type { CreateNotificationDTO } from '@core/types/notification/mutations.js'
import type { IOrderModuleService } from '@core/types/order/service.js'
import { Modules, NotificationTemplates } from '@core/utils/index.js'
import { env } from '@env'
import type { AwilixContainer } from 'awilix'
import { prepareOrderConfirmationData } from './prepare-order-confirmation-data.js'

/**
 * The order confirmation, built from nothing but an order id.
 *
 * Reading the order rather than being handed it is what makes this callable from anywhere that
 * knows an order happened — a checkout step today, an `order.placed` subscriber next. An event
 * payload carries ids, not DTOs, so a builder that took an `OrderDTO` would push the same four
 * reads back into every caller.
 *
 * It returns the notification instead of sending it. Who sends, and what happens when the send
 * fails, is the caller's decision: checkout swallows the failure because the payment is already
 * authorized by the time it sends, while a subscriber wants the throw so the transport retries it.
 * Both need the same body.
 */
export async function buildOrderConfirmationNotification(
  orderId: string,
  container: AwilixContainer,
): Promise<CreateNotificationDTO> {
  const orderService = container.resolve<IOrderModuleService>(Modules.ORDER)
  const order = await orderService.retrieveOrder(orderId)

  const [lineItems, shippingMethods, transactions, shippingAddress] = await Promise.all([
    orderService.listOrderLineItems({ orderId: order.id }),
    orderService.listOrderShippingMethods({ orderId: order.id }),
    orderService.listOrderTransactions({ orderId: order.id }),
    orderService.retrieveOrderAddress(order.id, 'shipping'),
  ])

  return {
    to: order.email,
    channel: 'email',
    template: NotificationTemplates.ORDER_CONFIRMATION,
    data: prepareOrderConfirmationData({
      order,
      lineItems: orderService.enrichLineItems(lineItems),
      totals: orderService.computeOrderTotals({ lineItems, shippingMethods, transactions }),
      shippingAddress,
      storeUrl: env.STORE_URL,
    }),
    triggerType: 'order.placed',
    resourceId: order.id,
    resourceType: 'order',
    // Guards against a duplicate email if the caller runs this more than once for the same order.
    idempotencyKey: `order-confirmation:${order.id}`,
  }
}

import type { CreateNotificationDTO } from '@core/types/notification/mutations.js'
import type { EnrichedOrderLineItemDTO, OrderAddressDTO, OrderDTO, OrderTotals } from '@core/types/order/common.js'
import { NotificationTemplates } from '@core/utils/notification-templates.js'
import { prepareOrderConfirmationData } from './prepare-order-confirmation-data.js'

export type OrderConfirmationInput = {
  order: OrderDTO
  lineItems: EnrichedOrderLineItemDTO[]
  totals: OrderTotals
  shippingAddress: OrderAddressDTO | null
  storeUrl: string
}

/**
 * The order confirmation as a value: order data in, a `CreateNotificationDTO` out.
 *
 * It returns the notification instead of sending it, because who sends — and what happens when the
 * send fails — differs by caller. The `order.placed` subscriber rethrows a refused send so the
 * transport retries it; a checkout step could not, because the payment is authorized by the time it
 * would run. Ending here is what lets the same body serve both.
 *
 * Being handed the order rather than reading it is what keeps this a util under the rule the tree
 * states: no services, no container, no I/O. The reads are four calls on one module service and
 * belong to whoever already resolved it.
 */
export function buildOrderConfirmationNotification(input: OrderConfirmationInput): CreateNotificationDTO {
  const { order } = input

  return {
    to: order.email,
    channel: 'email',
    template: NotificationTemplates.ORDER_CONFIRMATION,
    data: prepareOrderConfirmationData(input),
    triggerType: 'order.placed',
    resourceId: order.id,
    resourceType: 'order',
    // Guards against a duplicate email if the caller runs this more than once for the same order.
    idempotencyKey: `order-confirmation:${order.id}`,
  }
}

import type { FulfillmentDTO } from '@core/types/fulfillment/common.js'
import type { OrderFulfillmentStatus } from '@core/types/order/common.js'

export function computeFulfillmentStatus(fulfillments: FulfillmentDTO[]): OrderFulfillmentStatus {
  const fulfillment = fulfillments[0]
  if (!fulfillment || fulfillment.canceledAt) return 'unfulfilled'
  if (fulfillment.deliveredAt) return 'delivered'
  if (fulfillment.shippedAt) return 'shipped'
  if (fulfillment.packedAt) return 'fulfilled'
  return 'unfulfilled'
}

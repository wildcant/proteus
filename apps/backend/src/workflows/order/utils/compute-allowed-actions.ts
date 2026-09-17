import type { OrderAllowedActions, OrderDTO, OrderFulfillmentStatus } from '@core/types/order/common.js'

export function computeAllowedActions(order: OrderDTO, fulfillmentStatus: OrderFulfillmentStatus): OrderAllowedActions {
  return {
    canComplete: order.status === 'pending',
    canCancel: order.status === 'pending' && fulfillmentStatus === 'unfulfilled',
    canArchive: order.status === 'completed',
    canFulfill: order.status === 'pending' && fulfillmentStatus === 'unfulfilled',
    canShip: order.status !== 'canceled' && fulfillmentStatus === 'fulfilled',
    canMarkAsDelivered: order.status !== 'canceled' && fulfillmentStatus === 'shipped',
  }
}

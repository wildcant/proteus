import type { StoreOrderFulfillmentStatus } from '#/api/generated/model'

/** The wire values are lowercase single words; the shopper reads a phrase. */
export const fulfillmentLabels: Record<StoreOrderFulfillmentStatus, string> = {
  unfulfilled: 'Preparing',
  fulfilled: 'Ready to ship',
  shipped: 'Shipped',
  delivered: 'Delivered',
}

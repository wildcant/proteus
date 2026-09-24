import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import type { StoreOrderFulfillmentStatus } from '#/api/generated/model'

/** The wire values are lowercase single words; the shopper reads a phrase. */
export const fulfillmentLabels: Record<StoreOrderFulfillmentStatus, MessageDescriptor> = {
  unfulfilled: msg`Preparing`,
  fulfilled: msg`Ready to ship`,
  shipped: msg`Shipped`,
  delivered: msg`Delivered`,
}

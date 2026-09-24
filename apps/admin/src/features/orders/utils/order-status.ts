import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import type { AdminOrderFulfillmentStatus, AdminOrderStatus } from '#/api/generated/model'

type StatusColor = 'green' | 'red' | 'blue' | 'orange' | 'grey' | 'purple'

export const orderStatusColors: Record<AdminOrderStatus, StatusColor> = {
  pending: 'orange',
  completed: 'green',
  canceled: 'red',
  archived: 'grey',
}

export const fulfillmentStatusColors: Record<AdminOrderFulfillmentStatus, StatusColor> = {
  unfulfilled: 'orange',
  fulfilled: 'blue',
  shipped: 'purple',
  delivered: 'green',
}

// Badges render the raw value capitalised by CSS, so the English label is the value itself.
export const orderStatusLabels: Record<AdminOrderStatus, MessageDescriptor> = {
  pending: msg`pending`,
  completed: msg`completed`,
  canceled: msg`canceled`,
  archived: msg`archived`,
}

export const fulfillmentStatusLabels: Record<AdminOrderFulfillmentStatus, MessageDescriptor> = {
  unfulfilled: msg`unfulfilled`,
  fulfilled: msg`fulfilled`,
  shipped: msg`shipped`,
  delivered: msg`delivered`,
}

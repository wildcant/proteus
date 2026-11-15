// biome-ignore-all lint/style/useNamingConvention: keyed by the API's payment status values, which are Medusa's snake_case
import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import type { AdminOrderFulfillmentStatus, AdminOrderStatus, OrderPaymentStatus } from '#/api/generated/model'

type StatusColor = 'green' | 'red' | 'blue' | 'orange' | 'grey' | 'purple'

export const orderStatusColors: Record<AdminOrderStatus, StatusColor> = {
  draft: 'grey',
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

export const paymentStatusColors: Record<OrderPaymentStatus, StatusColor> = {
  not_paid: 'grey',
  awaiting: 'orange',
  authorized: 'blue',
  partially_authorized: 'orange',
  partially_captured: 'orange',
  captured: 'green',
  partially_refunded: 'purple',
  refunded: 'purple',
  canceled: 'red',
  requires_action: 'red',
}

// Badges render the raw value capitalised by CSS, so the English label is the value itself (underscores read as spaces).
export const orderStatusLabels: Record<AdminOrderStatus, MessageDescriptor> = {
  draft: msg`draft`,
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

export const paymentStatusLabels: Record<OrderPaymentStatus, MessageDescriptor> = {
  not_paid: msg`not paid`,
  awaiting: msg`awaiting`,
  authorized: msg`authorized`,
  partially_authorized: msg`partially authorized`,
  partially_captured: msg`partially captured`,
  captured: msg`captured`,
  partially_refunded: msg`partially refunded`,
  refunded: msg`refunded`,
  canceled: msg`canceled`,
  requires_action: msg`requires action`,
}

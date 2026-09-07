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

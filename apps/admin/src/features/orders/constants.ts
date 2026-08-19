import type { AdminOrderFulfillmentStatus, AdminOrderStatus } from '#/api/generated/model'

export const orderStatusBadgeVariants: Record<AdminOrderStatus, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  pending: 'outline',
  completed: 'default',
  canceled: 'destructive',
  archived: 'secondary',
}

export const fulfillmentStatusBadgeVariants: Record<
  AdminOrderFulfillmentStatus,
  'default' | 'secondary' | 'outline' | 'destructive'
> = {
  unfulfilled: 'outline',
  fulfilled: 'default',
  shipped: 'secondary',
  delivered: 'default',
}

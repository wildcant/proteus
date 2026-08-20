import { z } from 'zod'
import { createDateOperatorMap, createFindParams, type FindParams } from '../../common.js'
import { OrderFulfillmentStatus, OrderStatus } from './entities.js'

export const AdminOrderListParams = createFindParams().extend({
  q: z.string().optional(),
  status: z.union([OrderStatus, OrderStatus.array()]).optional(),
  fulfillmentStatus: z.union([OrderFulfillmentStatus, OrderFulfillmentStatus.array()]).optional(),
  customerId: z.union([z.string(), z.array(z.string())]).optional(),
  createdAt: createDateOperatorMap().optional(),
})

export type AdminOrderListQuery = FindParams<typeof AdminOrderListParams>

export const OrderFulfillmentIdParams = z.object({
  id: z.string().min(1),
  fulfillmentId: z.string().min(1),
})
export type OrderFulfillmentIdParams = z.infer<typeof OrderFulfillmentIdParams>

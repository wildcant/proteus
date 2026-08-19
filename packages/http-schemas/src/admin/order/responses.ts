import { z } from 'zod'
import { PaginatedResponse } from '../../common.js'
import {
  AdminOrder,
  AdminOrderAllowedActions,
  AdminOrderLineItem,
  AdminOrderShippingMethod,
  AdminOrderTotals,
  AdminOrderTransaction,
} from './entities.js'

const AdminOrderWithDetails = AdminOrder.extend({
  lineItems: z.array(AdminOrderLineItem),
  shippingMethods: z.array(AdminOrderShippingMethod),
  transactions: z.array(AdminOrderTransaction),
  totals: AdminOrderTotals,
  allowedActions: AdminOrderAllowedActions,
})

export const AdminOrderResponse = z.object({ order: AdminOrderWithDetails }).openapi('AdminOrderResponse')
export type AdminOrderResponse = z.input<typeof AdminOrderResponse>

export const AdminOrderActionResponse = z.object({ order: AdminOrder }).openapi('AdminOrderActionResponse')
export type AdminOrderActionResponse = z.input<typeof AdminOrderActionResponse>

export const AdminOrderListResponse = PaginatedResponse.extend({
  orders: z.array(AdminOrder),
}).openapi('AdminOrderListResponse')
export type AdminOrderListResponse = z.input<typeof AdminOrderListResponse>

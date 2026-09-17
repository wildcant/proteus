import { z } from 'zod'
import { PaginatedResponse } from '../../common.js'
import {
  AdminOrder,
  AdminOrderAddress,
  AdminOrderAllowedActions,
  AdminOrderFulfillment,
  AdminOrderLineItem,
  AdminOrderShippingMethod,
  AdminOrderTotals,
  AdminOrderTransaction,
} from './entities.js'

export const PaymentStatus = z.enum(['awaiting', 'authorized', 'captured'])

const AdminOrderWithDetails = AdminOrder.extend({
  lineItems: z.array(AdminOrderLineItem),
  shippingMethods: z.array(AdminOrderShippingMethod),
  transactions: z.array(AdminOrderTransaction),
  totals: AdminOrderTotals,
  paymentStatus: PaymentStatus,
  allowedActions: AdminOrderAllowedActions,
  shippingAddress: AdminOrderAddress.nullable(),
  fulfillments: z.array(AdminOrderFulfillment),
})

export const AdminOrderResponse = z.object({ order: AdminOrderWithDetails }).openapi('AdminOrderResponse')
export type AdminOrderResponse = z.input<typeof AdminOrderResponse>

export const AdminOrderActionResponse = z.object({ order: AdminOrder }).openapi('AdminOrderActionResponse')
export type AdminOrderActionResponse = z.input<typeof AdminOrderActionResponse>

export const AdminOrderListResponse = PaginatedResponse.extend({
  orders: z.array(AdminOrder),
}).openapi('AdminOrderListResponse')
export type AdminOrderListResponse = z.input<typeof AdminOrderListResponse>

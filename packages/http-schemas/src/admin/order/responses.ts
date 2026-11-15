import { z } from 'zod'
import { OrderPaymentStatus, PaginatedResponse } from '../../common.js'
import { AdminPaymentCollection } from '../payment/entities.js'
import {
  AdminDraftOrder,
  AdminOrder,
  AdminOrderAddress,
  AdminOrderAllowedActions,
  AdminOrderFulfillment,
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
  paymentStatus: OrderPaymentStatus,
  allowedActions: AdminOrderAllowedActions,
  shippingAddress: AdminOrderAddress.nullable(),
  fulfillments: z.array(AdminOrderFulfillment),
  /** One per Order in Proteus, with its payments, their captures and refunds. */
  paymentCollections: z.array(AdminPaymentCollection),
})

export const AdminOrderResponse = z.object({ order: AdminOrderWithDetails }).openapi('AdminOrderResponse')
export type AdminOrderResponse = z.input<typeof AdminOrderResponse>

export const AdminOrderActionResponse = z.object({ order: AdminOrder }).openapi('AdminOrderActionResponse')
export type AdminOrderActionResponse = z.input<typeof AdminOrderActionResponse>

export const AdminOrderListResponse = PaginatedResponse.extend({
  orders: z.array(AdminOrder),
}).openapi('AdminOrderListResponse')
export type AdminOrderListResponse = z.input<typeof AdminOrderListResponse>

export const AdminDraftOrderListResponse = PaginatedResponse.extend({
  draftOrders: z.array(AdminDraftOrder),
}).openapi('AdminDraftOrderListResponse')
export type AdminDraftOrderListResponse = z.input<typeof AdminDraftOrderListResponse>

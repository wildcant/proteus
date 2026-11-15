import { z } from 'zod'
import {
  AdminDraftOrder,
  AdminOrderAddress,
  AdminOrderLineItem,
  AdminOrderShippingMethod,
  AdminOrderTotals,
} from '../order/entities.js'

/** A Draft Order as the shop confirms it in the chat: its pairs, address and phone, shipping and totals. */
const AdminDraftOrderWithDetails = AdminDraftOrder.extend({
  lineItems: z.array(AdminOrderLineItem),
  shippingMethods: z.array(AdminOrderShippingMethod),
  shippingAddress: AdminOrderAddress.nullable(),
  totals: AdminOrderTotals,
})

export const AdminDraftOrderResponse = z
  .object({ draftOrder: AdminDraftOrderWithDetails })
  .openapi('AdminDraftOrderResponse')
export type AdminDraftOrderResponse = z.input<typeof AdminDraftOrderResponse>

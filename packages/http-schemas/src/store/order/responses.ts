import { z } from 'zod'
import { bigNumberToString, PaginatedResponse } from '../../common.js'
import {
  StoreOrder,
  StoreOrderAddress,
  StoreOrderItemSummary,
  StoreOrderLineItem,
  StoreOrderShippingMethod,
  StoreOrderTotals,
} from './entities.js'

const StoreOrderListItem = StoreOrder.extend({
  items: z.array(StoreOrderItemSummary),
  total: bigNumberToString,
})

export const StoreOrderListResponse = PaginatedResponse.extend({
  orders: z.array(StoreOrderListItem),
}).openapi('StoreOrderListResponse')
export type StoreOrderListResponse = z.input<typeof StoreOrderListResponse>

const StoreOrderWithDetails = StoreOrder.extend({
  lineItems: z.array(StoreOrderLineItem),
  shippingAddress: StoreOrderAddress.nullable(),
  shippingMethods: z.array(StoreOrderShippingMethod),
  totals: StoreOrderTotals,
  paymentStatus: z.enum(['awaiting', 'authorized', 'captured']),
})

export const StoreOrderResponse = z.object({ order: StoreOrderWithDetails }).openapi('StoreOrderResponse')
export type StoreOrderResponse = z.input<typeof StoreOrderResponse>

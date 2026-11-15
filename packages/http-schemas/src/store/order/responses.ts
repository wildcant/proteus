import { z } from 'zod'
import { bigNumberToString, PaginatedResponse } from '../../common.js'
import { StoreOrder, StoreOrderDetail, StoreOrderItemSummary } from './entities.js'

const StoreOrderListItem = StoreOrder.extend({
  items: z.array(StoreOrderItemSummary),
  total: bigNumberToString,
})

export const StoreOrderListResponse = PaginatedResponse.extend({
  orders: z.array(StoreOrderListItem),
}).openapi('StoreOrderListResponse')
export type StoreOrderListResponse = z.input<typeof StoreOrderListResponse>

export const StoreOrderResponse = z.object({ order: StoreOrderDetail }).openapi('StoreOrderResponse')
export type StoreOrderResponse = z.input<typeof StoreOrderResponse>

/** Only the id: the Order itself is read through its link, like any other shopper's. */
export const StoreOrderLookupResponse = z.object({ id: z.string() }).openapi('StoreOrderLookupResponse')
export type StoreOrderLookupResponse = z.input<typeof StoreOrderLookupResponse>

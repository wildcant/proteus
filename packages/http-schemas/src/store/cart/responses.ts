import { z } from 'zod'
import {
  StoreCart,
  StoreCartLineItem,
  StoreCartShippingMethod,
  StoreCartTotals,
  StoreConfirmInventoryItem,
} from './entities.js'

export const StoreCartResponse = z.object({ cart: StoreCart }).openapi('StoreCartResponse')
export type StoreCartResponse = z.input<typeof StoreCartResponse>

export const StoreCreateCartResponse = z.object({ cart: StoreCart }).openapi('StoreCreateCartResponse')
export type StoreCreateCartResponse = z.input<typeof StoreCreateCartResponse>

export const StoreUpdateCartResponse = z.object({ cart: StoreCart }).openapi('StoreUpdateCartResponse')
export type StoreUpdateCartResponse = z.input<typeof StoreUpdateCartResponse>

export const StoreCartDetailResponse = z
  .object({
    cart: StoreCart.extend({
      items: z.array(StoreCartLineItem),
      shippingMethods: z.array(StoreCartShippingMethod),
      totals: StoreCartTotals,
    }),
  })
  .openapi('StoreCartDetailResponse')
export type StoreCartDetailResponse = z.input<typeof StoreCartDetailResponse>

export const StoreCartLineItemResponse = z.object({ lineItem: StoreCartLineItem }).openapi('StoreCartLineItemResponse')
export type StoreCartLineItemResponse = z.input<typeof StoreCartLineItemResponse>

export const StoreCreateCartLineItemResponse = z
  .object({ lineItem: StoreCartLineItem })
  .openapi('StoreCreateCartLineItemResponse')
export type StoreCreateCartLineItemResponse = z.input<typeof StoreCreateCartLineItemResponse>

export const StoreUpdateCartLineItemResponse = z
  .object({ lineItem: StoreCartLineItem })
  .openapi('StoreUpdateCartLineItemResponse')
export type StoreUpdateCartLineItemResponse = z.input<typeof StoreUpdateCartLineItemResponse>

export const StoreCreateCartShippingMethodResponse = z
  .object({ shippingMethod: StoreCartShippingMethod })
  .openapi('StoreCreateCartShippingMethodResponse')
export type StoreCreateCartShippingMethodResponse = z.input<typeof StoreCreateCartShippingMethodResponse>

export const StoreCartInventoryResponse = z
  .object({
    cartId: z.string(),
    items: z.array(StoreConfirmInventoryItem),
  })
  .openapi('StoreCartInventoryResponse')
export type StoreCartInventoryResponse = z.input<typeof StoreCartInventoryResponse>

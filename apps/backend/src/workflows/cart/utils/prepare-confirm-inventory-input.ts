import type { InventoryLevelDTO } from '@core/types/inventory/common.js'
import type { ProductVariantInventoryItemDTO } from '@core/types/link/common.js'
import {
  type InventoryLineItem,
  type LineItemInventoryCheck,
  prepareLineItemInventoryChecks,
} from './variant-inventory.js'

export type ConfirmInventoryResult = {
  cartId: string
  items: LineItemInventoryCheck[]
}

/**
 * What a cart already holding its line items needs confirmed in stock.
 *
 * The cart id travels with the items because this is `confirm-inventory`'s output, and the caller
 * that reads it back is answering about a cart. Reservation shares the fan-out and not this shape:
 * it runs after the order exists and keys to the order's line items instead.
 */
export function prepareConfirmInventoryInput(data: {
  cartId: string
  lineItems: InventoryLineItem[]
  mappings: ProductVariantInventoryItemDTO[]
  levels: InventoryLevelDTO[]
}): ConfirmInventoryResult {
  return { cartId: data.cartId, items: prepareLineItemInventoryChecks(data.lineItems, data.mappings, data.levels) }
}

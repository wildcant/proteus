import type { CartLineItemDTO } from '@core/types/cart/common.js'
import type { InventoryLevelDTO } from '@core/types/inventory/common.js'
import type { ProductVariantInventoryItemDTO } from '@core/types/link/common.js'
import { indexVariantInventory } from './variant-inventory.js'

export type ConfirmInventoryItem = {
  lineItemId: string
  variantId: string
  inventoryItemId: string
  requiredQuantity: number
  quantity: number
  locationIds: string[]
}

export type ConfirmInventoryResult = {
  cartId: string
  items: ConfirmInventoryItem[]
}

/**
 * What a cart already holding its line items needs confirmed in stock.
 *
 * Keyed by line item, unlike {@link prepareVariantInventoryChecks}, because the reservations
 * `complete-cart` writes from this point back at the row they were taken for.
 */
export function prepareConfirmInventoryInput(data: {
  cartId: string
  lineItems: CartLineItemDTO[]
  mappings: ProductVariantInventoryItemDTO[]
  levels: InventoryLevelDTO[]
}): ConfirmInventoryResult {
  const backingByVariantId = indexVariantInventory(data.mappings, data.levels)

  const items = data.lineItems.flatMap((lineItem) => {
    const variantId = lineItem.variantId
    if (!variantId) return []

    return (backingByVariantId.get(variantId) ?? []).map((backing) => ({
      ...backing,
      lineItemId: lineItem.id,
      variantId,
      quantity: lineItem.quantity,
    }))
  })

  return { cartId: data.cartId, items }
}

import type { ProductVariantInventoryItemDTO } from '@core/types/link/common.js'
import type { VariantStockFlags } from '../../cart/utils/variant-inventory.js'

/**
 * The answer the storefront renders, rather than the number it would have to threshold itself.
 *
 * `remaining` rides only on the branch that shows it, so there is no quantity in hand when the
 * copy does not call for one — and no second "can I buy this" boolean beside it, which is the
 * drift this union replaced `inStock` to kill. Mirrors `StoreVariantStock` in
 * `@proteus/http-schemas`; named here because nothing below `api/` may import the wire schemas.
 */
export type VariantStock = { state: 'available' } | { state: 'low'; remaining: number } | { state: 'soldOut' }

/**
 * How many units of one variant a shopper could still buy, or `null` when the catalogue says the
 * question does not apply.
 *
 * `null` is the answer for a variant the shop does not track and for one it will sell past zero:
 * neither has a number a shopper could be told, and both are permanently buyable. A tracked
 * variant with no inventory item behind it is `0` rather than `null` — checkout refuses it as
 * invalid data, and offering what checkout will refuse is exactly the drift this projection
 * exists to prevent. The refusal itself is not raised here, because one variant with bad data
 * would take down the whole product page rather than the one row it belongs to.
 *
 * TODO(inventory): a backorder variant is rendered as plainly available — the button says Add to
 * cart and nothing tells the shopper they are waiting for stock. A distinct backorder state is a
 * conversion decision rather than a technical one, and is deferred until someone makes it. It
 * belongs here, where untracked, backorder and in-stock collapse into one answer.
 */
function purchasableUnits(
  variant: VariantStockFlags,
  links: ProductVariantInventoryItemDTO[],
  availableByItemId: Map<string, number>,
): number | null {
  if (!variant.manageInventory || variant.allowBackorder) return null
  if (links.length === 0) return 0

  // What the scarcest of its inventory items allows, so a variant needing two of something is sold
  // out at one on the shelf rather than at zero. The subtraction behind each available quantity
  // lives in `IInventoryModuleService.retrieveAvailableQuantity` — the same one `confirmInventory`
  // uses at checkout, so the storefront cannot offer what confirmation would refuse.
  return Math.min(
    ...links.map((link) => Math.floor((availableByItemId.get(link.inventoryItemId) ?? 0) / link.requiredQuantity)),
  )
}

/**
 * The stock projection over one inventory picture: hand it a variant, it answers what the shopper
 * is told about that variant.
 *
 * A function rather than a map keyed by variant id, so every variant a caller holds has an answer
 * by construction and no caller has to invent one for a lookup that missed.
 *
 * `soldOut` wins over `low` at zero: nothing left is not a small number left, however low the
 * threshold is set. A `null` threshold turns the low state off entirely — the same one setting
 * silences the shopkeeper's alert and the shopper's "only N left" line, so a shop that has not set
 * one is never told a variant is running out.
 */
export function variantStockProjection(
  links: ProductVariantInventoryItemDTO[],
  availableByItemId: Map<string, number>,
  lowStockThreshold: number | null,
): (variant: VariantStockFlags) => VariantStock {
  const linksByVariantId = new Map<string, ProductVariantInventoryItemDTO[]>()
  for (const link of links) {
    linksByVariantId.set(link.variantId, [...(linksByVariantId.get(link.variantId) ?? []), link])
  }

  return (variant) => {
    const remaining = purchasableUnits(variant, linksByVariantId.get(variant.id) ?? [], availableByItemId)
    if (remaining === null) return { state: 'available' }
    if (remaining <= 0) return { state: 'soldOut' }
    if (lowStockThreshold !== null && remaining <= lowStockThreshold) return { state: 'low', remaining }
    return { state: 'available' }
  }
}

/** Whether a shopper can put this variant in a cart — the one bit the option picker reads. */
export function isPurchasable(stock: VariantStock): boolean {
  return stock.state !== 'soldOut'
}

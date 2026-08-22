import type { ProductVariantInventoryItemDTO } from '@core/types/link/common.js'

/**
 * Decides which variants can actually be bought, by composing two module answers: the link module
 * says which inventory items a variant needs and how many of each, and the inventory module says
 * how much of each item is available. The subtraction lives in
 * {@link IInventoryModuleService.retrieveAvailableQuantity} — the same one `confirmInventory` uses
 * at checkout, so the storefront cannot offer a variant that then fails cart confirmation.
 *
 * A variant with no inventory link is absent from the result, and its caller counts it as buyable.
 *
 * TODO(inventory): evaluate stock availability logic after inventory feature is complete.
 * `manageInventory` and `allowBackorder` are read by nothing in the codebase — not here, not by
 * confirmInventory, not by complete-cart. Honouring them is a deliberate, whole-repo change.
 */
export function buildVariantStock(
  links: ProductVariantInventoryItemDTO[],
  availableByItemId: Map<string, number>,
): Map<string, boolean> {
  const inStockByVariantId = new Map<string, boolean>()

  for (const link of links) {
    const covered = (availableByItemId.get(link.inventoryItemId) ?? 0) >= link.requiredQuantity
    inStockByVariantId.set(link.variantId, (inStockByVariantId.get(link.variantId) ?? true) && covered)
  }

  return inStockByVariantId
}

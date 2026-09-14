import type { ProductVariantInventoryItemDTO } from '@core/types/link/common.js'
import type { VariantStockFlags } from '../../cart/utils/variant-inventory.js'

/**
 * Which variants a shopper can actually buy, by composing three answers: the catalogue says
 * whether a variant is tracked at all and whether it may be sold past what is on the shelf, the
 * link module says which inventory items it needs and how many of each, and the inventory module
 * says how much of each item is available. The subtraction lives in
 * {@link IInventoryModuleService.retrieveAvailableQuantity} — the same one `confirmInventory` uses
 * at checkout, so the storefront cannot offer a variant that then fails cart confirmation.
 *
 * Three arrangements collapse to buyable here: a variant the shop does not track, one that allows
 * a backorder, and one whose stock covers its requirement.
 *
 * TODO(inventory): a backorder variant is rendered as plainly available — the button says Add to
 * cart and nothing tells the shopper they are waiting for stock. A distinct backorder state is a
 * conversion decision rather than a technical one, and is deferred until someone makes it. It
 * belongs here, where the three states are flattened into one answer.
 *
 * A tracked variant with no inventory item is *not* buyable. Checkout refuses it as invalid data,
 * and offering what checkout will refuse is the drift this projection exists to prevent; the
 * refusal itself is not raised here, because one variant with bad data would take down the whole
 * product page rather than the one row it belongs to.
 */
export function buildBuyableVariantIds(
  variants: VariantStockFlags[],
  links: ProductVariantInventoryItemDTO[],
  availableByItemId: Map<string, number>,
): Set<string> {
  const linksByVariantId = new Map<string, ProductVariantInventoryItemDTO[]>()
  for (const link of links) {
    linksByVariantId.set(link.variantId, [...(linksByVariantId.get(link.variantId) ?? []), link])
  }

  const buyable = new Set<string>()
  for (const variant of variants) {
    if (!variant.manageInventory || variant.allowBackorder) {
      buyable.add(variant.id)
      continue
    }

    const variantLinks = linksByVariantId.get(variant.id) ?? []
    if (variantLinks.length === 0) continue

    const covered = variantLinks.every(
      (link) => (availableByItemId.get(link.inventoryItemId) ?? 0) >= link.requiredQuantity,
    )
    if (covered) buyable.add(variant.id)
  }

  return buyable
}

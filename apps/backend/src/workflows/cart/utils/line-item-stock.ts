import type { ProductVariantInventoryItemDTO } from '@core/types/link/common.js'
import {
  type VariantStock,
  variantPurchasableQuantityProjection,
  variantStockProjection,
} from '../../product/utils/build-variant-stock.js'
import type { VariantStockFlags } from './variant-inventory.js'

/**
 * What a cart line tells the shopper about the variant behind it. Mirrors `stock` and
 * `maxQuantity` on `StoreCartLineItem`; named here because nothing below `api/` may import the wire
 * schemas.
 */
export type LineItemStock = {
  stock: VariantStock
  /** The most the line may hold, for the quantity stepper to stop at; `null` when nothing caps it. */
  maxQuantity: number | null
}

/**
 * A line whose variant the catalogue no longer holds cannot be bought any more than a sold-out
 * one, and the storefront blocks checkout on both the same way: remove the line to continue.
 */
const UNAVAILABLE: LineItemStock = { stock: { state: 'soldOut' }, maxQuantity: 0 }

/**
 * The stock projection over one inventory picture, asked per cart line.
 *
 * `variants` are the live variants the lines point at; a line naming one that is not among them —
 * deleted since it was added, or never recorded — answers {@link UNAVAILABLE}. A quantity above
 * what is left does not make a line unavailable: the stepper clamps to `maxQuantity` and the
 * quantity update refuses anything past it.
 */
export function lineItemStockProjection(
  variants: VariantStockFlags[],
  links: ProductVariantInventoryItemDTO[],
  availableByItemId: Map<string, number>,
  lowStockThreshold: number | null,
): (lineItem: { variantId: string | null }) => LineItemStock {
  const variantById = new Map(variants.map((variant) => [variant.id, variant]))
  const stockOf = variantStockProjection(links, availableByItemId, lowStockThreshold)
  const maxQuantityOf = variantPurchasableQuantityProjection(links, availableByItemId)

  return (lineItem) => {
    const variant = lineItem.variantId ? variantById.get(lineItem.variantId) : undefined
    if (!variant) return UNAVAILABLE

    return { stock: stockOf(variant), maxQuantity: maxQuantityOf(variant) }
  }
}

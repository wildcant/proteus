import type { InventoryLevelDTO } from '@core/types/inventory/common.js'
import type { ProductVariantInventoryItemDTO } from '@core/types/link/common.js'

/** One inventory item standing behind a variant, and where its stock can be drawn from. */
export type VariantInventoryBacking = {
  inventoryItemId: string
  /** Units of that item one unit of the variant consumes. */
  requiredQuantity: number
  locationIds: string[]
}

/** How many units of a variant a check has to cover. */
export type VariantDemand = {
  variantId: string
  quantity: number
}

export type VariantInventoryCheck = VariantInventoryBacking & VariantDemand

/**
 * The inventory backing each variant, keyed for lookup.
 *
 * A variant with no mapping is absent rather than empty, which is what lets both callers treat
 * "not stock-managed" as "always available" without a second flag.
 */
export function indexVariantInventory(
  mappings: ProductVariantInventoryItemDTO[],
  levels: InventoryLevelDTO[],
): Map<string, VariantInventoryBacking[]> {
  const locationsByInventoryItemId = new Map<string, string[]>()
  for (const level of levels) {
    const locationIds = locationsByInventoryItemId.get(level.inventoryItemId) ?? []
    locationIds.push(level.locationId)
    locationsByInventoryItemId.set(level.inventoryItemId, locationIds)
  }

  const backingByVariantId = new Map<string, VariantInventoryBacking[]>()
  for (const mapping of mappings) {
    const backings = backingByVariantId.get(mapping.variantId) ?? []
    backings.push({
      inventoryItemId: mapping.inventoryItemId,
      requiredQuantity: mapping.requiredQuantity,
      locationIds: locationsByInventoryItemId.get(mapping.inventoryItemId) ?? [],
    })
    backingByVariantId.set(mapping.variantId, backings)
  }

  return backingByVariantId
}

/**
 * What has to be confirmed in stock for a set of variant quantities.
 *
 * Keyed by variant rather than by line item, because an addition is checked before it is written
 * — the rows it will merge into do not yet hold the quantity being asked for. Demands for the
 * same variant are summed, so two additions of one variant in a single call are confirmed
 * against their total and not twice against the same stock.
 */
export function prepareVariantInventoryChecks(
  demands: VariantDemand[],
  mappings: ProductVariantInventoryItemDTO[],
  levels: InventoryLevelDTO[],
): VariantInventoryCheck[] {
  const backingByVariantId = indexVariantInventory(mappings, levels)

  const quantityByVariantId = new Map<string, number>()
  for (const demand of demands) {
    quantityByVariantId.set(demand.variantId, (quantityByVariantId.get(demand.variantId) ?? 0) + demand.quantity)
  }

  return [...quantityByVariantId].flatMap(([variantId, quantity]) =>
    (backingByVariantId.get(variantId) ?? []).map((backing) => ({ ...backing, variantId, quantity })),
  )
}

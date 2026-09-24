import type { InventoryLevelDTO } from '@core/types/inventory/common.js'
import type { ProductVariantInventoryItemDTO } from '@core/types/link/common.js'
import { i18n, type Msgid } from '@proteus/utils'

/** One inventory item standing behind a variant, and where its stock can be drawn from. */
type VariantInventoryBacking = {
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

/**
 * What the catalogue says about a variant's stock: whether the shop tracks it at all, and whether
 * it may be sold past what is on the shelf. Structural rather than the product module's DTO,
 * because these two flags are all confirmation, reservation and the storefront projection read of
 * a variant — and all three ask the same question of them.
 */
export type VariantStockFlags = {
  id: string
  manageInventory: boolean
  allowBackorder: boolean
}

/** Carried onto the reservation the check becomes, so releasing one is symmetric with writing it. */
type BackorderFlag = { allowBackorder: boolean }

export type VariantInventoryCheck = VariantInventoryBacking & VariantDemand & BackorderFlag

/** A line item as inventory reads one: which row, for which variant, in what quantity. Structural
 *  rather than a module's DTO, because a cart's line items and an order's are both read this way —
 *  confirmation is handed the cart's, reservation the order's. */
export type InventoryLineItem = {
  id: string
  variantId: string | null
  quantity: number
}

export type LineItemInventoryCheck = VariantInventoryBacking &
  BackorderFlag & {
    lineItemId: string
    variantId: string
    quantity: number
  }

/**
 * The inventory backing each variant, keyed for lookup.
 *
 * A variant with no mapping is absent rather than empty. Which of the two things that means —
 * nothing to track, or an inventory item that should exist and does not — is the catalogue's
 * answer and not this map's: see {@link variantBackings} and {@link missingInventoryItemMessage}.
 */
function indexVariantInventory(
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

function indexVariantFlags(variants: VariantStockFlags[]): Map<string, VariantStockFlags> {
  return new Map(variants.map((variant) => [variant.id, variant]))
}

/**
 * What has to be checked for one variant, and under which rule.
 *
 * An untracked variant yields nothing: it is dropped before confirmation and before reservation,
 * which is what keeps a made-to-order item permanently buyable. A tracked one yields its backings
 * and carries its backorder flag down onto them.
 *
 * A variant the catalogue does not hold at all is left exactly as it was before the flags were
 * read — checked against whatever mappings it has, which is not the same claim as being untracked.
 * A line item naming a variant that no longer exists is its own fault, answered where line items
 * are validated rather than silently here.
 */
function variantBackings(
  variantId: string,
  flagsByVariantId: Map<string, VariantStockFlags>,
  backingByVariantId: Map<string, VariantInventoryBacking[]>,
): (VariantInventoryBacking & BackorderFlag)[] {
  const flags = flagsByVariantId.get(variantId)
  if (flags && !flags.manageInventory) return []

  const allowBackorder = flags?.allowBackorder ?? false

  return (backingByVariantId.get(variantId) ?? []).map((backing) => ({ ...backing, allowBackorder }))
}

/**
 * The refusal a variant the shop tracks with no inventory item behind it earns, or `null` when
 * every tracked variant has one.
 *
 * Until the flags were read this arrangement was silently treated as buyable, which is what let a
 * variant created through the admin — where nothing creates an inventory item — be sold without
 * limit. It is bad data about the variant rather than a shopper who arrived too late, so it names
 * the variant and refuses.
 *
 * Returned rather than thrown: a util that raised `WorkflowTerminalError` would keep the error
 * type out of the `throws` list each workflow declares and every one of its routes spreads, so
 * the refusal would reach a client the OpenAPI document says cannot receive it.
 */
export function missingInventoryItemMessage(
  variants: VariantStockFlags[],
  mappings: ProductVariantInventoryItemDTO[],
): { message: Msgid; values: Record<string, unknown> } | null {
  const backed = new Set(mappings.map((mapping) => mapping.variantId))
  const unbacked = variants.filter((variant) => variant.manageInventory && !backed.has(variant.id))
  const [first] = unbacked
  if (!first) return null
  if (unbacked.length === 1) {
    return {
      message: i18n.t('Variant "{variantId}" is tracked, but no inventory item is linked to it'),
      values: { variantId: first.id },
    }
  }

  return {
    message: i18n.t('Variants {variantIds} are tracked, but no inventory item is linked to them'),
    values: { variantIds: unbacked.map((variant) => `"${variant.id}"`).join(', ') },
  }
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
  variants: VariantStockFlags[],
  mappings: ProductVariantInventoryItemDTO[],
  levels: InventoryLevelDTO[],
): VariantInventoryCheck[] {
  const backingByVariantId = indexVariantInventory(mappings, levels)
  const flagsByVariantId = indexVariantFlags(variants)

  const quantityByVariantId = new Map<string, number>()
  for (const demand of demands) {
    quantityByVariantId.set(demand.variantId, (quantityByVariantId.get(demand.variantId) ?? 0) + demand.quantity)
  }

  return [...quantityByVariantId].flatMap(([variantId, quantity]) =>
    variantBackings(variantId, flagsByVariantId, backingByVariantId).map((backing) => ({
      ...backing,
      variantId,
      quantity,
    })),
  )
}

/**
 * What has to be confirmed in stock, or reserved, for line items that already exist.
 *
 * Keyed by line item rather than by variant, unlike {@link prepareVariantInventoryChecks}: a
 * reservation points back at the row it was taken for, which is how cancelling and fulfilling find
 * it again. Quantities are therefore left per row rather than summed — two lines for one variant
 * are two reservations, each answerable on its own.
 */
export function prepareLineItemInventoryChecks(
  lineItems: InventoryLineItem[],
  variants: VariantStockFlags[],
  mappings: ProductVariantInventoryItemDTO[],
  levels: InventoryLevelDTO[],
): LineItemInventoryCheck[] {
  const backingByVariantId = indexVariantInventory(mappings, levels)
  const flagsByVariantId = indexVariantFlags(variants)

  return lineItems.flatMap((lineItem) => {
    const variantId = lineItem.variantId
    if (!variantId) return []

    return variantBackings(variantId, flagsByVariantId, backingByVariantId).map((backing) => ({
      ...backing,
      lineItemId: lineItem.id,
      variantId,
      quantity: lineItem.quantity,
    }))
  })
}

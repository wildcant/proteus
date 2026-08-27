import type { CartLineItemDTO } from '@core/types/cart/common.js'
import type { CreateLineItemDTO, LineItemUpdateDTO } from '@core/types/cart/mutations.js'

/** The fields a merge decision reads off a row the cart already holds. */
export type MergeableLineItem = Pick<CartLineItemDTO, 'id' | 'variantId' | 'quantity' | 'unitPrice'>

/**
 * A row an addition folds into. The patch the cart module writes, plus the variant it is for —
 * carried so the merged quantity can be confirmed against stock before anything is written.
 */
export type LineItemMerge = LineItemUpdateDTO & { variantId: string }

/** Assignable to `CartLineItemPlanDTO`, so it goes to the cart module as it stands. */
export type LineItemPlan = {
  create: CreateLineItemDTO[]
  merge: LineItemMerge[]
}

/**
 * Splits an addition into rows to write and rows to bump.
 *
 * A cart holds one line per variant: adding a variant it already carries raises that line's
 * quantity rather than appending a second one the shopper then has to reconcile by hand.
 * Repeats within a single payload fold the same way, so `[{v, 1}, {v, 2}]` is one line of three.
 *
 * The variant is the whole merge key. Medusa also keys on metadata and on whether the caller
 * overrode the price, because its line items carry both; ours carry neither — every price is
 * resolved from the catalogue, so two lines of one variant could only differ by when they were
 * added.
 *
 * A merged line takes the incoming price rather than keeping its own: the addition was priced
 * against the catalogue a moment ago, and leaving the older snapshot would sell the whole line
 * at a price that is no longer offered.
 */
export function planLineItemActions(existing: MergeableLineItem[], incoming: CreateLineItemDTO[]): LineItemPlan {
  const existingByVariantId = new Map<string, MergeableLineItem>()
  for (const item of existing) {
    // First writer wins. Carts written before this workflow existed can hold two rows of one
    // variant, and picking one of them beats growing the pile.
    if (item.variantId && !existingByVariantId.has(item.variantId)) {
      existingByVariantId.set(item.variantId, item)
    }
  }

  const create: CreateLineItemDTO[] = []
  const merge: LineItemMerge[] = []
  const plannedCreateByVariantId = new Map<string, CreateLineItemDTO>()
  const plannedMergeByVariantId = new Map<string, LineItemMerge>()

  for (const item of incoming) {
    const variantId = item.variantId
    // Nothing to match a custom line against, so it always becomes a row of its own.
    if (!variantId) {
      create.push({ ...item })
      continue
    }

    const plannedMerge = plannedMergeByVariantId.get(variantId)
    if (plannedMerge) {
      plannedMerge.data.quantity = (plannedMerge.data.quantity ?? 0) + item.quantity
      continue
    }

    const plannedCreate = plannedCreateByVariantId.get(variantId)
    if (plannedCreate) {
      plannedCreate.quantity += item.quantity
      continue
    }

    const row = existingByVariantId.get(variantId)
    if (!row) {
      const draft = { ...item }
      plannedCreateByVariantId.set(variantId, draft)
      create.push(draft)
      continue
    }

    const entry: LineItemMerge = {
      id: row.id,
      variantId,
      data: { quantity: row.quantity + item.quantity, unitPrice: item.unitPrice },
    }
    plannedMergeByVariantId.set(variantId, entry)
    merge.push(entry)
  }

  return { create, merge }
}

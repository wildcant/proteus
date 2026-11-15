import { ErrorTypes } from '@core/errors/app-error.js'
import { ContainerRegistrationKeys } from '@core/utils/container.js'
import { Modules } from '@core/utils/modules-definition.js'
import { type WorkflowContext, WorkflowTerminalError } from '@core/workflows/types.js'
import { i18n } from '@proteus/utils'
import { missingInventoryItemMessage, prepareLineItemInventoryChecks } from '../utils/variant-inventory.js'

export const confirmLineItemsSellableThrows = [ErrorTypes.CONFLICT, ErrorTypes.INVALID_DATA] as const

/** A line as the shopper and the shop name it: its title, and the option values that pick the variant. */
export type SellableLineItem = {
  id: string
  title: string
  variantOptionValues: string | null
  variantId: string | null
  quantity: number
}

/**
 * Refuses lines that can't be sold as they stand, naming the first one: a line whose variant the
 * catalogue no longer holds, and a tracked line the shelf no longer covers in its quantity.
 *
 * A Cart line or an Order line alike. Sending a Cart to the shop as a draft and converting that
 * draft both ask it, because neither should hand the shop an item it can't ship; the refusal names
 * the line, so the shopper or the admin knows which one to take out. It reserves nothing:
 * converting reserves afterwards, and the reservation stays the guard against a concurrent sale.
 */
export async function confirmLineItemsSellableStep(ctx: WorkflowContext, lineItems: SellableLineItem[]): Promise<void> {
  await ctx.step('confirm-line-items-sellable', async ({ container }) => {
    const productService = container.resolve(Modules.PRODUCT)
    const inventoryService = container.resolve(Modules.INVENTORY)
    const linkService = container.resolve(ContainerRegistrationKeys.LINK)

    const label = (item: SellableLineItem) =>
      item.variantOptionValues ? `${item.title} (${item.variantOptionValues})` : item.title

    const variantIds = [...new Set(lineItems.flatMap((item) => (item.variantId ? [item.variantId] : [])))]
    const variants = variantIds.length > 0 ? await productService.listProductVariants({ id: variantIds }) : []
    const liveVariantIds = new Set(variants.map((variant) => variant.id))

    const discontinued = lineItems.find((item) => !item.variantId || !liveVariantIds.has(item.variantId))
    if (discontinued) {
      throw new WorkflowTerminalError({
        type: ErrorTypes.CONFLICT,
        message: i18n.t('"{item}" is no longer sold — remove it to continue'),
        values: { item: label(discontinued) },
      })
    }

    const mappings = await linkService.repo('productVariantInventoryItem').findByVariantIds(variantIds)
    const missingInventoryItem = missingInventoryItemMessage(variants, mappings)
    if (missingInventoryItem) {
      throw new WorkflowTerminalError({ type: ErrorTypes.INVALID_DATA, ...missingInventoryItem })
    }

    const inventoryItemIds = [...new Set(mappings.map((mapping) => mapping.inventoryItemId))]
    const levels = await inventoryService.listInventoryLevels({ inventoryItemId: inventoryItemIds })

    /** A backorder is stock the shop promises before it has it, so it is asked to cover nothing. */
    const checks = prepareLineItemInventoryChecks(lineItems, variants, mappings, levels).filter(
      (check) => !check.allowBackorder,
    )
    const uncovered = await Promise.all(
      checks.map(async (check) => {
        const covered = await inventoryService.confirmInventory(
          check.inventoryItemId,
          check.locationIds,
          check.quantity * check.requiredQuantity,
        )
        return covered ? null : check.lineItemId
      }),
    )
    const soldOut = lineItems.find((item) => uncovered.includes(item.id))
    if (soldOut) {
      throw new WorkflowTerminalError({
        type: ErrorTypes.CONFLICT,
        message: i18n.t('"{item}" is sold out in the quantity asked for — remove it or lower its quantity'),
        values: { item: label(soldOut) },
      })
    }
  })
}

import { ContainerRegistrationKeys } from '@core/utils/container.js'
import { Modules } from '@core/utils/modules-definition.js'
import type { MiddlewareFunction } from '@framework/http/types.js'
import { type LineItemStock, lineItemStockProjection } from '@workflows/cart/utils/line-item-stock.js'
import { buildAvailableQuantities } from '@workflows/product/utils/build-variant-stock.js'

type StockedLine = { variantId: string | null }

/** Reads the stock behind these lines and answers, per line, what `lineItemStockProjection` says of it. */
type LineItemStockReader = (lineItems: StockedLine[]) => Promise<(lineItem: StockedLine) => LineItemStock>

/**
 * Puts the live stock read on the request, for every cart route that answers with a line's stock or
 * prices only the lines that can still be bought.
 *
 * Stock is read live rather than kept on the line: what the shelf holds now is what decides whether
 * the line can still be bought and where its stepper stops. A reader rather than the stock itself,
 * because the line-item routes only know their line after the write, and must read its stock then
 * so the stepper the response redraws stops where the cart page would.
 */
export function attachLineItemStock(): MiddlewareFunction<{ lineItemStock: LineItemStockReader }> {
  return async (req) => {
    const productService = req.scope.resolve(Modules.PRODUCT)
    const inventoryService = req.scope.resolve(Modules.INVENTORY)
    const storeService = req.scope.resolve(Modules.STORE)
    const linkService = req.scope.resolve(ContainerRegistrationKeys.LINK)

    const lineItemStock: LineItemStockReader = async (lineItems) => {
      const variantIds = [...new Set(lineItems.flatMap((lineItem) => (lineItem.variantId ? [lineItem.variantId] : [])))]
      const [variants, inventoryLinks, store] = await Promise.all([
        // An empty filter array would reach the query builder as `inArray(column, [])`.
        variantIds.length > 0 ? productService.listProductVariants({ id: variantIds }) : [],
        linkService.repo('productVariantInventoryItem').findByVariantIds(variantIds),
        storeService.resolveStore(),
      ])
      const itemIds = [...new Set(inventoryLinks.map((link) => link.inventoryItemId))]
      // Every item's levels in one read, as the product routes read them.
      const levels = itemIds.length > 0 ? await inventoryService.listInventoryLevels({ inventoryItemId: itemIds }) : []

      return lineItemStockProjection(
        variants,
        inventoryLinks,
        buildAvailableQuantities(levels),
        store?.lowStockThreshold ?? null,
      )
    }

    return { ...req, lineItemStock }
  }
}

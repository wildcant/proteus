import { ContainerRegistrationKeys } from '@core/utils/container.js'
import { Modules } from '@core/utils/modules-definition.js'
import { createWorkflow } from '@core/workflows/types.js'

type DeleteProductVariantInput = { variantId: string }

export const deleteProductVariantWorkflow = createWorkflow<DeleteProductVariantInput, void>(
  'delete-product-variant',
  async (ctx, input) => {
    // Step 1: Dismiss all links referencing this variant
    const dismissed = await ctx.step('dismiss-variant-links', async ({ container }) => {
      const linkService = container.resolve(ContainerRegistrationKeys.LINK)
      return linkService.dismissLinks({ variantId: [input.variantId] })
    })

    // Step 2: Clean up linked pricing entities
    await ctx.step('delete-pricing-entities', async ({ container }) => {
      const dismissedPriceSetLinks = dismissed.productVariantPriceSet ?? []
      if (dismissedPriceSetLinks.length === 0) return
      const pricingService = container.resolve(Modules.PRICING)
      await pricingService.softDeletePriceSets(dismissedPriceSetLinks.map((link) => link.priceSetId))
    })

    // Step 3: Take the variant's inventory with it, so the inventory list does not fill with rows
    // pointing at nothing. An item another variant still links to stays — the link that just went
    // is not the only one holding it.
    await ctx.step('delete-inventory-items', async ({ container }) => {
      const dismissedInventoryLinks = dismissed.productVariantInventoryItem ?? []
      if (dismissedInventoryLinks.length === 0) return

      const linkService = container.resolve(ContainerRegistrationKeys.LINK)
      const inventoryItemIds = [...new Set(dismissedInventoryLinks.map((link) => link.inventoryItemId))]

      const surviving = await linkService
        .repo('productVariantInventoryItem')
        .find({ inventoryItemId: inventoryItemIds })
      const stillLinked = new Set(surviving.map((link) => link.inventoryItemId))
      const orphaned = inventoryItemIds.filter((itemId) => !stillLinked.has(itemId))
      if (orphaned.length === 0) return

      const inventoryService = container.resolve(Modules.INVENTORY)
      await inventoryService.softDeleteInventoryItems(orphaned)
    })

    // Step 4: Delete variant
    await ctx.step('delete-variant', async ({ container }) => {
      const productService = container.resolve(Modules.PRODUCT)
      await productService.softDeleteProductVariants([input.variantId])
    })
  },
)

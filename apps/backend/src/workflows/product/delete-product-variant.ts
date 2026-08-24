import type { ILinkService } from '@core/types/link/service.js'
import type { IPricingModuleService } from '@core/types/pricing/service.js'
import type { IProductModuleService } from '@core/types/product/service.js'
import { ContainerRegistrationKeys, Modules } from '@core/utils/index.js'
import { createWorkflow } from '@core/workflows/types.js'

type DeleteProductVariantInput = { variantId: string }

export const deleteProductVariantWorkflow = createWorkflow<DeleteProductVariantInput, void>(
  'delete-product-variant',
  async (ctx, input) => {
    // Step 1: Dismiss all links referencing this variant
    const dismissed = await ctx.step('dismiss-variant-links', async ({ container }) => {
      const linkService = container.resolve<ILinkService>(ContainerRegistrationKeys.LINK)
      return linkService.dismissLinks({ variantId: [input.variantId] })
    })

    // Step 2: Clean up linked pricing entities
    await ctx.step('delete-pricing-entities', async ({ container }) => {
      const dismissedPriceSetLinks = dismissed.productVariantPriceSet ?? []
      if (dismissedPriceSetLinks.length === 0) return
      const pricingService = container.resolve<IPricingModuleService>(Modules.PRICING)
      await pricingService.softDeletePriceSets(dismissedPriceSetLinks.map((link) => link.priceSetId))
    })

    // Step 3: Delete variant
    await ctx.step('delete-variant', async ({ container }) => {
      const productService = container.resolve<IProductModuleService>(Modules.PRODUCT)
      await productService.softDeleteProductVariants([input.variantId])
    })
  },
)

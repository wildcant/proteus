import type { ILinkService } from '@core/types/link/service.js'
import type { IPricingModuleService } from '@core/types/pricing/service.js'
import type { ProductVariantExtendedDTO } from '@core/types/product/common.js'
import type { IProductModuleService } from '@core/types/product/service.js'
import { ContainerRegistrationKeys, Modules } from '@core/utils/index.js'
import { createWorkflow } from '@core/workflows/types.js'
import type { AdminCreateProductVariantBody } from '@proteus/http-schemas/admin'

type CreateProductVariantsInput = {
  productId: string
  variants: AdminCreateProductVariantBody[]
}

export const createProductVariantsWorkflow = createWorkflow<CreateProductVariantsInput, ProductVariantExtendedDTO[]>(
  'create-product-variants',
  async (ctx, input) => {
    // Step 1: Create all variants (without prices)
    const variants = await ctx.step(
      'create-variants',
      async ({ container }) => {
        const productService = container.resolve<IProductModuleService>(Modules.PRODUCT)
        return productService.createProductVariants(
          input.variants.map((variant) => ({ ...variant, productId: input.productId })),
        )
      },
      async (created, { container }) => {
        const productService = container.resolve<IProductModuleService>(Modules.PRODUCT)
        await productService.softDeleteProductVariants(created.map((variant) => variant.id))
      },
    )

    // Step 2: Create price sets for variants that have prices
    const priceSets = await ctx.step(
      'create-price-sets',
      async ({ container }) => {
        const pricingService = container.resolve<IPricingModuleService>(Modules.PRICING)
        const variantsWithPrices = input.variants
          .map((variant, index) => ({ index, prices: variant.prices }))
          .filter((entry) => entry.prices && entry.prices.length > 0)

        if (variantsWithPrices.length === 0) return []

        const created = await pricingService.createPriceSets(
          variantsWithPrices.map((entry) => ({
            prices: entry.prices?.map((price) => ({ currencyCode: 'usd', amount: price.amount })),
          })),
        )

        return variantsWithPrices.map((entry, index) => ({
          variantId: variants[entry.index]?.id ?? '',
          priceSetId: created[index]?.id ?? '',
        }))
      },
      async (created, { container }) => {
        if (created.length === 0) return
        const pricingService = container.resolve<IPricingModuleService>(Modules.PRICING)
        await pricingService.softDeletePriceSets(created.map((link) => link.priceSetId))
      },
    )

    // Step 3: Link variants to price sets
    await ctx.step(
      'link-variants-to-price-sets',
      async ({ container }) => {
        if (priceSets.length === 0) return
        const linkService = container.resolve<ILinkService>(ContainerRegistrationKeys.LINK)
        await Promise.all(
          priceSets.map((priceSetLink) =>
            linkService
              .repo('productVariantPriceSet')
              .create({ variantId: priceSetLink.variantId, priceSetId: priceSetLink.priceSetId }),
          ),
        )
      },
      async (_result, { container }) => {
        if (priceSets.length === 0) return
        const linkService = container.resolve<ILinkService>(ContainerRegistrationKeys.LINK)
        const variantIds = priceSets.map((priceSetLink) => priceSetLink.variantId)
        const variantAndPriceSetLinks = await linkService.repo('productVariantPriceSet').findByVariantIds(variantIds)
        if (variantAndPriceSetLinks.length > 0) {
          await linkService.repo('productVariantPriceSet').softDelete(variantAndPriceSetLinks.map((link) => link.id))
        }
      },
    )

    // Step 4: Enrich variants with their created prices
    const enriched = await ctx.step('enrich-with-prices', async ({ container }) => {
      if (priceSets.length === 0) return variants as ProductVariantExtendedDTO[]

      const pricingService = container.resolve<IPricingModuleService>(Modules.PRICING)
      const priceSetByVariantId = new Map(
        priceSets.map((priceSetLink) => [priceSetLink.variantId, priceSetLink.priceSetId]),
      )

      return Promise.all(
        variants.map(async (variant) => {
          const priceSetId = priceSetByVariantId.get(variant.id)
          if (!priceSetId) return variant as ProductVariantExtendedDTO
          const prices = await pricingService.listPrices({ priceSetId })
          return { ...variant, prices }
        }),
      )
    })

    return enriched
  },
)

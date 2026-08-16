import type { ILinkService } from '@core/types/link/service.js'
import type { PriceDTO } from '@core/types/pricing/common.js'
import type { IPricingModuleService } from '@core/types/pricing/service.js'
import type { ProductVariantExtendedDTO } from '@core/types/product/common.js'
import type { IProductModuleService } from '@core/types/product/service.js'
import { ContainerRegistrationKeys, Modules } from '@core/utils/index.js'
import { createWorkflow } from '@core/workflows/types.js'
import type { AdminUpdateProductVariantBody } from '@proteus/http-schemas/admin'

type UpdateProductVariantInput = {
  variantId: string
  data: AdminUpdateProductVariantBody
}

export const updateProductVariantWorkflow = createWorkflow<UpdateProductVariantInput, ProductVariantExtendedDTO>(
  'update-product-variant',
  async (ctx, input) => {
    // Step 1: Update variant fields
    const { variant } = await ctx.step(
      'update-variant',
      async ({ container }) => {
        const productService = container.resolve<IProductModuleService>(Modules.PRODUCT)
        const { prices: _, ...variantData } = input.data
        const previous = await productService.retrieveProductVariant(input.variantId)
        const variant = await productService.updateProductVariant(input.variantId, variantData)
        return { variant, prevData: { ...previous, variantRank: previous.variantRank ?? undefined } }
      },
      async ({ prevData }, { container }) => {
        const productService = container.resolve<IProductModuleService>(Modules.PRODUCT)
        await productService.upsertProductVariants([prevData])
      },
    )

    // Step 2: Resolve or create pricing link (only if prices were provided)
    const variantAndPriceSetLink = await ctx.step(
      'resolve-pricing-link',
      async ({ container }) => {
        if (!input.data.prices) return null

        const linkService = container.resolve<ILinkService>(ContainerRegistrationKeys.LINK)
        const pricingService = container.resolve<IPricingModuleService>(Modules.PRICING)

        const [existing] = await linkService.repo('productVariantPriceSet').findByVariantIds([variant.id])
        if (existing) return { record: existing, created: false }

        const priceSet = await pricingService.createPriceSet({})
        const created = await linkService
          .repo('productVariantPriceSet')
          .create({ variantId: variant.id, priceSetId: priceSet.id })
        return { record: created, created: true }
      },
      async (result, { container }) => {
        if (!result?.created) return
        const linkService = container.resolve<ILinkService>(ContainerRegistrationKeys.LINK)
        const pricingService = container.resolve<IPricingModuleService>(Modules.PRICING)
        await linkService.repo('productVariantPriceSet').softDelete([result.record.id])
        await pricingService.deletePriceSets([result.record.priceSetId])
      },
    )

    // Step 3: Upsert prices (with compensation to restore previous prices)
    await ctx.step(
      'upsert-prices',
      async ({ container }) => {
        if (!variantAndPriceSetLink || !input.data.prices) return { prevPrices: [] as PriceDTO[] }
        const pricingService = container.resolve<IPricingModuleService>(Modules.PRICING)

        // Capture previous prices for compensation
        const prevPrices = await pricingService.listPrices({ priceSetId: variantAndPriceSetLink.record.priceSetId })

        await pricingService.upsertPriceSets([
          {
            id: variantAndPriceSetLink.record.priceSetId,
            prices: input.data.prices.map((p) => ({
              id: p.id,
              currencyCode: 'usd',
              amount: p.amount,
            })),
          },
        ])

        return { prevPrices }
      },
      async ({ prevPrices }, { container }) => {
        if (!variantAndPriceSetLink || prevPrices.length === 0) return
        const pricingService = container.resolve<IPricingModuleService>(Modules.PRICING)
        await pricingService.upsertPriceSets([
          {
            id: variantAndPriceSetLink.record.priceSetId,
            prices: prevPrices.map((p) => ({
              id: p.id,
              currencyCode: p.currencyCode,
              amount: p.amount,
            })),
          },
        ])
      },
    )

    // Step 4: Enrich with prices
    const enriched = await ctx.step('enrich-with-prices', async ({ container }) => {
      if (!variantAndPriceSetLink) return variant as ProductVariantExtendedDTO
      const pricingService = container.resolve<IPricingModuleService>(Modules.PRICING)
      const prices = await pricingService.listPrices({ priceSetId: variantAndPriceSetLink.record.priceSetId })
      return { ...variant, prices }
    })

    return enriched
  },
)

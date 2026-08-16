import type { ILinkService } from '@core/types/link/service.js'
import type { IPricingModuleService } from '@core/types/pricing/service.js'
import type { ProductVariantExtendedDTO } from '@core/types/product/common.js'
import type { IProductModuleService } from '@core/types/product/service.js'
import { ContainerRegistrationKeys, Modules } from '@core/utils/index.js'
import { createWorkflow } from '@core/workflows/types.js'
import type { AdminUpdateVariantPricesBody } from '@proteus/http-schemas/admin'

type UpdateVariantPricesInput = {
  variantId: string
  data: AdminUpdateVariantPricesBody
}

export const updateVariantPricesWorkflow = createWorkflow<UpdateVariantPricesInput, ProductVariantExtendedDTO>(
  'update-variant-prices',
  async (ctx, input) => {
    // Step 1: Retrieve variant (validates it exists)
    const variant = await ctx.step('retrieve-variant', async ({ container }) => {
      const productService = container.resolve<IProductModuleService>(Modules.PRODUCT)
      return productService.retrieveProductVariant(input.variantId)
    })

    // Step 2: Resolve or create pricing link
    const variantAndPriceSetLink = await ctx.step(
      'resolve-pricing-link',
      async ({ container }) => {
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
        if (!result.created) return
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
        const pricingService = container.resolve<IPricingModuleService>(Modules.PRICING)
        const prevPrices = await pricingService.listPrices({ priceSetId: variantAndPriceSetLink.record.priceSetId })

        await pricingService.upsertPriceSets([
          {
            id: variantAndPriceSetLink.record.priceSetId,
            prices: input.data.prices.map((price) => ({
              id: price.id,
              currencyCode: 'usd',
              amount: price.amount,
            })),
          },
        ])

        return { prevPrices }
      },
      async ({ prevPrices }, { container }) => {
        if (prevPrices.length === 0) return
        const pricingService = container.resolve<IPricingModuleService>(Modules.PRICING)
        await pricingService.upsertPriceSets([
          {
            id: variantAndPriceSetLink.record.priceSetId,
            prices: prevPrices.map((price) => ({
              id: price.id,
              currencyCode: price.currencyCode,
              amount: price.amount,
            })),
          },
        ])
      },
    )

    // Step 4: Enrich with prices
    const enriched = await ctx.step('enrich-with-prices', async ({ container }) => {
      const pricingService = container.resolve<IPricingModuleService>(Modules.PRICING)
      const prices = await pricingService.listPrices({ priceSetId: variantAndPriceSetLink.record.priceSetId })
      return { ...variant, prices }
    })

    return enriched
  },
)

import type { ProductVariantDTO } from '@core/types/product/common.js'
import type { IProductModuleService } from '@core/types/product/service.js'
import { Modules } from '@core/utils/index.js'
import { createWorkflow } from '@core/workflows/types.js'
import type { AdminUpdateProductVariantBody } from '@proteus/http-schemas/admin'

type UpdateProductVariantInput = {
  variantId: string
  data: AdminUpdateProductVariantBody
}

export const updateProductVariantWorkflow = createWorkflow<UpdateProductVariantInput, ProductVariantDTO>(
  'update-product-variant',
  async (ctx, input) => {
    const { variant } = await ctx.step(
      'update-variant',
      async ({ container }) => {
        const productService = container.resolve<IProductModuleService>(Modules.PRODUCT)
        const previous = await productService.retrieveProductVariant(input.variantId)
        const variant = await productService.updateProductVariant(input.variantId, input.data)
        return { variant, prevData: { ...previous, variantRank: previous.variantRank ?? undefined } }
      },
      async ({ prevData }, { container }) => {
        const productService = container.resolve<IProductModuleService>(Modules.PRODUCT)
        await productService.upsertProductVariants([prevData])
      },
    )

    return variant
  },
)

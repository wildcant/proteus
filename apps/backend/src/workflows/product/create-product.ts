import type { ProductDTO } from '@core/types/product/common.js'
import type { CreateProductDTO } from '@core/types/product/mutations.js'
import type { IProductModuleService } from '@core/types/product/service.js'
import { Modules } from '@core/utils/index.js'
import { createWorkflow } from '@core/workflows/types.js'
import type { AdminCreateProductVariantBody } from '@proteus/http-schemas/admin'
import { createProductVariantsWorkflow } from './create-product-variants.js'

type CreateProductInput = {
  product: CreateProductDTO
  options?: Array<{ optionId: string; valueIds: string[] }>
  variants?: AdminCreateProductVariantBody[]
}

/**
 * Creates a product, the options it offers and the variants that sell it, as one act.
 *
 * A variant names a combination of the product's options, so the options have to be linked before
 * the variants can validate against them. Doing it in three calls would let a failed variant leave
 * a product behind that the shopkeeper never asked for; here the compensation removes it.
 */
export const createProductWorkflow = createWorkflow<CreateProductInput, ProductDTO>(
  'create-product',
  async (ctx, input) => {
    const product = await ctx.step(
      'create-product',
      async ({ container }) => {
        const productService = container.resolve<IProductModuleService>(Modules.PRODUCT)
        return productService.createProduct(input.product)
      },
      async (created, { container }) => {
        const productService = container.resolve<IProductModuleService>(Modules.PRODUCT)
        await productService.softDeleteProducts([created.id])
      },
    )

    await ctx.step('set-options', async ({ container }) => {
      if (!input.options?.length) return
      const productService = container.resolve<IProductModuleService>(Modules.PRODUCT)
      // No reconciliation: a product created a moment ago has no variants to reconcile against.
      await productService.setProductOptions(product.id, { options: input.options })
    })

    await ctx.step('create-variants', async () => {
      if (!input.variants?.length) return
      await createProductVariantsWorkflow.run({ productId: product.id, variants: input.variants })
    })

    return product
  },
)

import type { IProductModuleService } from '@core/types/product/service.js'
import { Modules } from '@core/utils/index.js'
import { createWorkflow } from '@core/workflows/types.js'

type BatchImageVariantsInput = {
  imageId: string
  add?: string[]
  remove?: string[]
}

type BatchImageVariantsOutput = {
  added: string[]
  removed: string[]
}

export const batchImageVariantsWorkflow = createWorkflow<BatchImageVariantsInput, BatchImageVariantsOutput>(
  'batch-image-variants',
  async (ctx, input) => {
    // TODO(workflows): run these two steps in parallel — they touch disjoint sets of pivot rows,
    // so neither has to wait on the other. Kept serial until the engine's parallel-step support
    // lands, since compensation ordering for concurrent steps is not settled yet.
    const added = await ctx.step(
      'add-image-to-variants',
      async ({ container }) => {
        const toAdd = input.add ?? []
        if (toAdd.length === 0) return []
        const productService = container.resolve<IProductModuleService>(Modules.PRODUCT)
        await productService.addImageToVariant(toAdd.map((variantId) => ({ imageId: input.imageId, variantId })))
        return toAdd
      },
      async (addedVariantIds, { container }) => {
        if (addedVariantIds.length === 0) return
        const productService = container.resolve<IProductModuleService>(Modules.PRODUCT)
        await productService.removeImageFromVariant(
          addedVariantIds.map((variantId) => ({ imageId: input.imageId, variantId })),
        )
      },
    )

    const removed = await ctx.step(
      'remove-image-from-variants',
      async ({ container }) => {
        const toRemove = input.remove ?? []
        if (toRemove.length === 0) return []
        const productService = container.resolve<IProductModuleService>(Modules.PRODUCT)
        // Only report the variants that were actually linked, so compensation restores exactly what it removed.
        const linked = await productService.listProductVariantImages({
          imageId: input.imageId,
          variantId: toRemove,
        })
        const variantIds = linked.map((variantImage) => variantImage.variantId)
        await productService.removeImageFromVariant(
          variantIds.map((variantId) => ({ imageId: input.imageId, variantId })),
        )
        return variantIds
      },
      async (removedVariantIds, { container }) => {
        if (removedVariantIds.length === 0) return
        const productService = container.resolve<IProductModuleService>(Modules.PRODUCT)
        await productService.addImageToVariant(
          removedVariantIds.map((variantId) => ({ imageId: input.imageId, variantId })),
        )
      },
    )

    // A variant that no longer carries the image must not keep pointing at it as its thumbnail.
    await ctx.step(
      'clear-variant-thumbnails',
      async ({ container }) => {
        if (removed.length === 0) return { variantIds: [], url: null }
        const productService = container.resolve<IProductModuleService>(Modules.PRODUCT)
        const [image] = await productService.listProductImages({ id: input.imageId })
        if (!image) return { variantIds: [], url: null }

        const variants = await productService.listProductVariants({ id: removed })
        const variantIds = variants.filter((variant) => variant.thumbnail === image.url).map((variant) => variant.id)
        if (variantIds.length > 0) await productService.updateProductVariants(variantIds, { thumbnail: null })

        return { variantIds, url: image.url }
      },
      async (cleared, { container }) => {
        if (cleared.variantIds.length === 0 || !cleared.url) return
        const productService = container.resolve<IProductModuleService>(Modules.PRODUCT)
        await productService.updateProductVariants(cleared.variantIds, { thumbnail: cleared.url })
      },
    )

    return { added, removed }
  },
)

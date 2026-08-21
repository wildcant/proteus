import type { IProductModuleService } from '@core/types/product/service.js'
import { Modules } from '@core/utils/index.js'
import { createWorkflow } from '@core/workflows/types.js'

type BatchVariantImagesInput = {
  variantId: string
  add?: string[]
  remove?: string[]
}

type BatchVariantImagesOutput = {
  added: string[]
  removed: string[]
}

/**
 * The variant-scoped counterpart of `batchImageVariantsWorkflow`: one variant, many images.
 * Assigning a whole gallery to a variant is a single atomic run with one compensation path.
 */
export const batchVariantImagesWorkflow = createWorkflow<BatchVariantImagesInput, BatchVariantImagesOutput>(
  'batch-variant-images',
  async (ctx, input) => {
    // TODO(workflows): run these two steps in parallel — they touch disjoint sets of pivot rows,
    // so neither has to wait on the other. Kept serial until the engine's parallel-step support
    // lands, since compensation ordering for concurrent steps is not settled yet.
    const added = await ctx.step(
      'add-images-to-variant',
      async ({ container }) => {
        const toAdd = input.add ?? []
        if (toAdd.length === 0) return []
        const productService = container.resolve<IProductModuleService>(Modules.PRODUCT)
        await productService.addImageToVariant(toAdd.map((imageId) => ({ imageId, variantId: input.variantId })))
        return toAdd
      },
      async (addedImageIds, { container }) => {
        if (addedImageIds.length === 0) return
        const productService = container.resolve<IProductModuleService>(Modules.PRODUCT)
        await productService.removeImageFromVariant(
          addedImageIds.map((imageId) => ({ imageId, variantId: input.variantId })),
        )
      },
    )

    const removed = await ctx.step(
      'remove-images-from-variant',
      async ({ container }) => {
        const toRemove = input.remove ?? []
        if (toRemove.length === 0) return []
        const productService = container.resolve<IProductModuleService>(Modules.PRODUCT)
        // Only report the images that were actually linked, so compensation restores exactly what it removed.
        const linked = await productService.listProductVariantImages({
          variantId: input.variantId,
          imageId: toRemove,
        })
        const imageIds = linked.map((variantImage) => variantImage.imageId)
        await productService.removeImageFromVariant(
          imageIds.map((imageId) => ({ imageId, variantId: input.variantId })),
        )
        return imageIds
      },
      async (removedImageIds, { container }) => {
        if (removedImageIds.length === 0) return
        const productService = container.resolve<IProductModuleService>(Modules.PRODUCT)
        await productService.addImageToVariant(
          removedImageIds.map((imageId) => ({ imageId, variantId: input.variantId })),
        )
      },
    )

    // A variant that no longer carries the image must not keep pointing at it as its thumbnail.
    await ctx.step(
      'clear-variant-thumbnail',
      async ({ container }) => {
        if (removed.length === 0) return null
        const productService = container.resolve<IProductModuleService>(Modules.PRODUCT)

        const [variant] = await productService.listProductVariants({ id: input.variantId })
        if (!variant?.thumbnail) return null

        const images = await productService.listProductImages({ id: removed })
        if (!images.some((image) => image.url === variant.thumbnail)) return null

        await productService.updateProductVariants([input.variantId], { thumbnail: null })
        return variant.thumbnail
      },
      async (clearedUrl, { container }) => {
        if (!clearedUrl) return
        const productService = container.resolve<IProductModuleService>(Modules.PRODUCT)
        await productService.updateProductVariants([input.variantId], { thumbnail: clearedUrl })
      },
    )

    return { added, removed }
  },
)

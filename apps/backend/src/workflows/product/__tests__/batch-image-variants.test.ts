import { Modules } from '@core/utils/index.js'
import { createSimpleWorkflowEngine } from '@core/workflows/simple-adapter.js'
import { setWorkflowEngine } from '@core/workflows/types.js'
import { test } from '@tests/setup/test-extend.js'
import { asValue, createContainer } from 'awilix'
import { vi } from 'vitest'
import { batchImageVariantsWorkflow } from '../batch-image-variants.js'

const IMAGE = { id: 'img_1', url: 'https://cdn.test/a.png' }
const ADDED_VARIANT = 'variant_added'
const REMOVED_VARIANT = 'variant_removed'

function setup() {
  const productService = {
    addImageToVariant: vi.fn().mockResolvedValue([{ id: 'pvimg_new' }]),
    removeImageFromVariant: vi.fn().mockResolvedValue(undefined),
    listProductVariantImages: vi
      .fn()
      .mockResolvedValue([{ id: 'pvimg_old', imageId: IMAGE.id, variantId: REMOVED_VARIANT }]),
    listProductImages: vi.fn().mockResolvedValue([IMAGE]),
    listProductVariants: vi.fn().mockResolvedValue([{ id: REMOVED_VARIANT, thumbnail: IMAGE.url }]),
    updateProductVariants: vi.fn().mockResolvedValue([]),
  }

  const container = createContainer()
  container.register({ [Modules.PRODUCT]: asValue(productService) })
  setWorkflowEngine(createSimpleWorkflowEngine(), container)

  return productService
}

test.describe('batchImageVariantsWorkflow', () => {
  test('adds and removes variant associations and clears the affected thumbnails', async ({ expect }) => {
    const productService = setup()

    const result = await batchImageVariantsWorkflow.run({
      imageId: IMAGE.id,
      add: [ADDED_VARIANT],
      remove: [REMOVED_VARIANT],
    })

    expect(result).toEqual({ added: [ADDED_VARIANT], removed: [REMOVED_VARIANT] })
    expect(productService.addImageToVariant).toHaveBeenCalledWith([{ imageId: IMAGE.id, variantId: ADDED_VARIANT }])
    expect(productService.removeImageFromVariant).toHaveBeenCalledWith([
      { imageId: IMAGE.id, variantId: REMOVED_VARIANT },
    ])
    expect(productService.updateProductVariants).toHaveBeenCalledWith([REMOVED_VARIANT], { thumbnail: null })
  })

  test('skips variants whose thumbnail points at another image', async ({ expect }) => {
    const productService = setup()
    productService.listProductVariants.mockResolvedValue([
      { id: REMOVED_VARIANT, thumbnail: 'https://cdn.test/other.png' },
    ])

    await batchImageVariantsWorkflow.run({ imageId: IMAGE.id, remove: [REMOVED_VARIANT] })

    expect(productService.updateProductVariants).not.toHaveBeenCalled()
  })

  test('rolls both sides back when a later step fails', async ({ expect }) => {
    const productService = setup()
    productService.listProductImages.mockRejectedValue(new Error('boom'))

    await expect(
      batchImageVariantsWorkflow.run({ imageId: IMAGE.id, add: [ADDED_VARIANT], remove: [REMOVED_VARIANT] }),
    ).rejects.toThrow('boom')

    expect(productService.removeImageFromVariant).toHaveBeenCalledWith([
      { imageId: IMAGE.id, variantId: ADDED_VARIANT },
    ])
    expect(productService.addImageToVariant).toHaveBeenCalledWith([{ imageId: IMAGE.id, variantId: REMOVED_VARIANT }])
  })
})

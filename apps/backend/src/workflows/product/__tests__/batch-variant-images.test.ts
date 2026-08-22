import { Modules } from '@core/utils/index.js'
import { createSimpleWorkflowEngine } from '@core/workflows/simple-adapter.js'
import { setWorkflowEngine } from '@core/workflows/types.js'
import { test } from '@tests/setup/test-extend.js'
import { asValue, createContainer } from 'awilix'
import { vi } from 'vitest'
import { batchVariantImagesWorkflow } from '../batch-variant-images.js'

const VARIANT = { id: 'variant_1', thumbnail: 'https://cdn.test/removed.png' }
const ADDED_IMAGE = 'img_added'
const REMOVED_IMAGE = 'img_removed'

function setup() {
  const productService = {
    addImageToVariant: vi.fn().mockResolvedValue([{ id: 'pvimg_new' }]),
    removeImageFromVariant: vi.fn().mockResolvedValue(undefined),
    listProductVariantImages: vi
      .fn()
      .mockResolvedValue([{ id: 'pvimg_old', imageId: REMOVED_IMAGE, variantId: VARIANT.id }]),
    listProductImages: vi.fn().mockResolvedValue([{ id: REMOVED_IMAGE, url: VARIANT.thumbnail }]),
    listProductVariants: vi.fn().mockResolvedValue([VARIANT]),
    updateProductVariants: vi.fn().mockResolvedValue([]),
  }

  const container = createContainer()
  container.register({ [Modules.PRODUCT]: asValue(productService) })
  setWorkflowEngine(createSimpleWorkflowEngine(), container)

  return productService
}

test.describe('batchVariantImagesWorkflow', () => {
  test('adds and removes image associations and clears a thumbnail that lost its image', async ({ expect }) => {
    const productService = setup()

    const result = await batchVariantImagesWorkflow.run({
      variantId: VARIANT.id,
      add: [ADDED_IMAGE],
      remove: [REMOVED_IMAGE],
    })

    expect(result).toEqual({ added: [ADDED_IMAGE], removed: [REMOVED_IMAGE] })
    expect(productService.addImageToVariant).toHaveBeenCalledWith([{ imageId: ADDED_IMAGE, variantId: VARIANT.id }])
    expect(productService.removeImageFromVariant).toHaveBeenCalledWith([
      { imageId: REMOVED_IMAGE, variantId: VARIANT.id },
    ])
    expect(productService.updateProductVariants).toHaveBeenCalledWith([VARIANT.id], { thumbnail: null })
  })

  test('leaves a thumbnail that points at an image the variant keeps', async ({ expect }) => {
    const productService = setup()
    productService.listProductImages.mockResolvedValue([{ id: REMOVED_IMAGE, url: 'https://cdn.test/other.png' }])

    await batchVariantImagesWorkflow.run({ variantId: VARIANT.id, remove: [REMOVED_IMAGE] })

    expect(productService.updateProductVariants).not.toHaveBeenCalled()
  })

  test('reports only the images that were actually linked', async ({ expect }) => {
    const productService = setup()
    productService.listProductVariantImages.mockResolvedValue([])

    const result = await batchVariantImagesWorkflow.run({ variantId: VARIANT.id, remove: [REMOVED_IMAGE] })

    expect(result.removed).toEqual([])
    expect(productService.removeImageFromVariant).toHaveBeenCalledWith([])
  })

  test('rolls both sides back when a later step fails', async ({ expect }) => {
    const productService = setup()
    productService.listProductVariants.mockRejectedValue(new Error('boom'))

    await expect(
      batchVariantImagesWorkflow.run({ variantId: VARIANT.id, add: [ADDED_IMAGE], remove: [REMOVED_IMAGE] }),
    ).rejects.toThrow('boom')

    expect(productService.removeImageFromVariant).toHaveBeenCalledWith([
      { imageId: ADDED_IMAGE, variantId: VARIANT.id },
    ])
    expect(productService.addImageToVariant).toHaveBeenCalledWith([{ imageId: REMOVED_IMAGE, variantId: VARIANT.id }])
  })
})

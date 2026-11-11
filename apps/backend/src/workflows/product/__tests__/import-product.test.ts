import type { TestContainer } from '@tests/setup/create-container.js'
import { test } from '@tests/setup/test-extend.js'
import { importProductWorkflow } from '../import-product.js'

/**
 * The workflow on its own. Downloading a merchant's images is covered end to end by
 * `api/admin/product-imports/__tests__/product-import.api.test.ts`; this is the path that skips it.
 */

let container: TestContainer

test.beforeEach(async ({ createTestContainer }) => {
  container = await createTestContainer()
})

test.describe('importProductWorkflow', () => {
  test('attaches hosted image URLs as they are, without downloading them', async ({ expect, dto, service }) => {
    // Nothing listens on port 1, so a download would fail the product.
    const [front, back] = ['http://127.0.0.1:1/front.png', 'http://127.0.0.1:1/back.png']
    const generated = dto.generate.importedProduct({ imageUrls: [front, back] })
    const product = {
      ...generated,
      variants: generated.variants.map((variant) => ({ ...variant, imageUrl: back })),
    }

    await importProductWorkflow.run({ product, overwrite: false, hostedImages: true })

    const [created] = await service.read.products(container, { handle: product.handle })
    expect(created?.thumbnail).toBe(front)
    const images = await service.read.productImages(container, { productId: created?.id }, { order: { rank: 'ASC' } })
    expect(images.map((image) => image.url)).toEqual([front, back])
    const [variant] = await service.read.productVariants(container, { productId: created?.id })
    expect(await service.read.productVariantImages(container, { variantId: variant?.id })).toEqual([
      expect.objectContaining({ imageId: images[1]?.id }),
    ])
  })
})

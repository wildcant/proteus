import type { IProductModuleService } from '@core/types/product/service.js'
import { Modules } from '@core/utils/index.js'
import type { TestContainer } from '@tests/setup/create-container.js'
import { type Fixtures, test } from '@tests/setup/test-extend.js'
import { assertDefined } from '@tests/utils/assert-defined.js'
import { vi } from 'vitest'
import { batchImageVariantsWorkflow } from '../batch-image-variants.js'

type Services = Fixtures['service']

let container: TestContainer

test.beforeEach(async ({ createTestContainer }) => {
  container = await createTestContainer()
})

/** One image, shown by `showing` and not yet attached to `spare`. */
const imageShownByOneVariant = async (service: Services) => {
  const { product, images } = await service.create.product(container, {
    images: [{ url: 'https://cdn.test/shared.png' }],
  })
  const [image] = images
  assertDefined(image)

  const [showing, spare] = await service.create.productVariants(container, product.id, [{ thumbnail: image.url }, {}])
  assertDefined(showing)
  assertDefined(spare)

  await service.create.variantImages(container, [{ imageId: image.id, variantId: showing.id }])

  return { image, showing, spare }
}

const variantIdsFor = async (service: Services, imageId: string) =>
  (await service.read.productVariantImages(container, { imageId })).map((entry) => entry.variantId).sort()

test.describe('batchImageVariantsWorkflow', () => {
  test('attaches, detaches, and drops the thumbnails that lost the image', async ({ service, expect }) => {
    const { image, showing, spare } = await imageShownByOneVariant(service)

    const result = await batchImageVariantsWorkflow.run({
      imageId: image.id,
      add: [spare.id],
      remove: [showing.id],
    })

    expect(result).toEqual({ added: [spare.id], removed: [showing.id] })
    expect(await variantIdsFor(service, image.id)).toEqual([spare.id])
    expect(await service.read.productVariant(container, showing.id)).toMatchObject({ thumbnail: null })
  })

  test('leaves a variant whose thumbnail is a different image', async ({ service, expect }) => {
    const { image, showing } = await imageShownByOneVariant(service)
    await service.update.productVariant(container, showing.id, { thumbnail: 'https://cdn.test/other.png' })

    await batchImageVariantsWorkflow.run({ imageId: image.id, remove: [showing.id] })

    expect(await service.read.productVariant(container, showing.id)).toMatchObject({
      thumbnail: 'https://cdn.test/other.png',
    })
  })

  test('rolls both sides back when a later step fails', async ({ service, expect }) => {
    const { image, showing, spare } = await imageShownByOneVariant(service)

    // `clear-variant-thumbnails` runs after both pivot writes have committed.
    vi.spyOn(container.resolve<IProductModuleService>(Modules.PRODUCT), 'listProductImages').mockRejectedValueOnce(
      new Error('boom'),
    )

    await expect(
      batchImageVariantsWorkflow.run({ imageId: image.id, add: [spare.id], remove: [showing.id] }),
    ).rejects.toThrow('boom')

    expect(await variantIdsFor(service, image.id)).toEqual([showing.id])
  })
})

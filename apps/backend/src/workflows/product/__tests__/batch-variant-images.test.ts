import type { IProductModuleService } from '@core/types/product/service.js'
import { Modules } from '@core/utils/index.js'
import type { TestContainer } from '@tests/setup/create-container.js'
import { type Fixtures, test } from '@tests/setup/test-extend.js'
import { assertDefined } from '@tests/utils/assert-defined.js'
import { vi } from 'vitest'
import { batchVariantImagesWorkflow } from '../batch-variant-images.js'

type Services = Fixtures['service']

let container: TestContainer

test.beforeEach(async ({ createTestContainer }) => {
  container = await createTestContainer()
})

/** A variant carrying `linked` as its only image, with `spare` available to attach. */
const variantShowingOneImage = async (service: Services) => {
  const { product, images } = await service.create.product(container, {
    images: [{ url: 'https://cdn.test/linked.png' }, { url: 'https://cdn.test/spare.png' }],
  })
  const [linked, spare] = images
  assertDefined(linked)
  assertDefined(spare)

  const variant = await service.create.productVariant(container, product.id, { thumbnail: linked.url })
  await service.create.variantImages(container, [{ imageId: linked.id, variantId: variant.id }])

  return { variant, linked, spare }
}

const imageIdsOn = async (service: Services, variantId: string) =>
  (await service.read.productVariantImages(container, { variantId })).map((entry) => entry.imageId).sort()

test.describe('batchVariantImagesWorkflow', () => {
  test('attaches, detaches, and drops a thumbnail whose image left', async ({ service, expect }) => {
    const { variant, linked, spare } = await variantShowingOneImage(service)

    const result = await batchVariantImagesWorkflow.run({
      variantId: variant.id,
      add: [spare.id],
      remove: [linked.id],
    })

    expect(result).toEqual({ added: [spare.id], removed: [linked.id] })
    expect(await imageIdsOn(service, variant.id)).toEqual([spare.id])
    expect(await service.read.productVariant(container, variant.id)).toMatchObject({ thumbnail: null })
  })

  test('keeps a thumbnail that points at an image the variant still has', async ({ service, expect }) => {
    const { variant, linked, spare } = await variantShowingOneImage(service)
    // Thumbnail shows `spare`, but `linked` is the one being detached.
    await service.update.productVariant(container, variant.id, { thumbnail: spare.url })

    await batchVariantImagesWorkflow.run({ variantId: variant.id, remove: [linked.id] })

    expect(await service.read.productVariant(container, variant.id)).toMatchObject({ thumbnail: spare.url })
  })

  test('reports only the images that were actually attached', async ({ service, expect }) => {
    const { variant, spare } = await variantShowingOneImage(service)

    // `spare` was never attached to this variant, so there is nothing to detach.
    const result = await batchVariantImagesWorkflow.run({ variantId: variant.id, remove: [spare.id] })

    expect(result.removed).toEqual([])
  })

  test('rolls both sides back when a later step fails', async ({ service, expect }) => {
    const { variant, linked, spare } = await variantShowingOneImage(service)

    // `clear-variant-thumbnail` runs after both pivot writes have committed.
    vi.spyOn(container.resolve<IProductModuleService>(Modules.PRODUCT), 'listProductImages').mockRejectedValueOnce(
      new Error('boom'),
    )

    await expect(
      batchVariantImagesWorkflow.run({ variantId: variant.id, add: [spare.id], remove: [linked.id] }),
    ).rejects.toThrow('boom')

    expect(await imageIdsOn(service, variant.id)).toEqual([linked.id])
  })
})

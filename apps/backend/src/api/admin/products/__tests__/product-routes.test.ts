import type { DbProvider } from '@core/db/ports.js'
import type { CreateProductDTO, IProductModuleService } from '@core/types/index.js'
import { Modules } from '@core/utils/index.js'
import { applyMiddleware } from '@framework/http/apply-middleware.js'
import type { RouteDefinition } from '@framework/http/types.js'
import { test } from '@tests/setup/test-extend.js'
import { makeRequest } from '@tests/utils/make-request.js'
import type { AwilixContainer } from 'awilix'
import { bootstrapContainer } from '../../../../container.js'
import type * as imageVariantBatchRoutes from '../[id]/images/[imageId]/variants/batch/route.js'
import type * as imageVariantRoutes from '../[id]/images/[imageId]/variants/route.js'
import type * as productByIdRoutes from '../[id]/route.js'
import type * as variantImageBatchRoutes from '../[id]/variants/[variantId]/images/batch/route.js'
import type * as variantByIdRoutes from '../[id]/variants/[variantId]/route.js'
import productDefinitions from '../definitions.js'
import type * as productRoutes from '../route.js'

let container: AwilixContainer
let productService: IProductModuleService

const findDefinition = (method: string, matcher: string): RouteDefinition => {
  const definition = productDefinitions.find((d) => d.method === method && d.matcher === matcher)
  if (!definition) throw new Error(`No route definition for ${method} ${matcher}`)
  return definition
}

test.beforeEach(async ({ getDb, logger }) => {
  const dbProvider: DbProvider = {
    getDb,
    withConnection: (fn) => fn(),
    shutdown: async () => {
      // noop
    },
  }
  container = await bootstrapContainer({ logger, dbProvider })
  productService = container.resolve<IProductModuleService>(Modules.PRODUCT)
})

test.describe('GET /admin/products/:id', () => {
  test('returns images ordered by rank', async ({ expect, dto }) => {
    const product = await productService.createProduct(
      dto.generate.createProduct({
        images: [{ url: 'https://cdn.test/a.png' }, { url: 'https://cdn.test/b.png' }],
      }),
    )
    const handler = applyMiddleware(findDefinition('GET', '/admin/products/:id'))

    const response = await handler<typeof productByIdRoutes.GetOutput>(
      makeRequest({ scope: container, params: { id: product.id } }),
    )

    expect(response.status).toBe(200)
    expect(response.json.product.images).toEqual([
      { id: expect.any(String), url: 'https://cdn.test/a.png', rank: 0 },
      { id: expect.any(String), url: 'https://cdn.test/b.png', rank: 1 },
    ])
  })
})

test.describe('GET /admin/products', () => {
  test('returns the thumbnail but no images array', async ({ expect, dto }) => {
    await productService.createProduct(dto.generate.createProduct({ images: [{ url: 'https://cdn.test/a.png' }] }))
    const handler = applyMiddleware(findDefinition('GET', '/admin/products'))

    const response = await handler<typeof productRoutes.GetOutput>(makeRequest({ scope: container }))

    expect(response.status).toBe(200)
    expect(response.json.products[0]?.thumbnail).toBe('https://cdn.test/a.png')
    expect(response.json.products[0]).not.toHaveProperty('images')
  })
})

test.describe('POST /admin/products', () => {
  test('creates the product with its images', async ({ expect }) => {
    const handler = applyMiddleware(findDefinition('POST', '/admin/products'))

    const response = await handler<typeof productRoutes.PostOutput>(
      makeRequest({
        scope: container,
        body: { title: 'Camera', images: [{ url: 'https://cdn.test/a.png' }] },
      }),
    )

    expect(response.status).toBe(201)
    expect(response.json.product.thumbnail).toBe('https://cdn.test/a.png')
    const images = await productService.listProductImages({ productId: response.json.product.id })
    expect(images.map((i) => i.url)).toEqual(['https://cdn.test/a.png'])
  })
})

test.describe('PATCH /admin/products/:id', () => {
  test('replaces the image collection', async ({ expect, dto }) => {
    const product = await productService.createProduct(
      dto.generate.createProduct({ images: [{ url: 'https://cdn.test/a.png' }] }),
    )
    const handler = applyMiddleware(findDefinition('PATCH', '/admin/products/:id'))

    const response = await handler<typeof productByIdRoutes.PatchOutput>(
      makeRequest({
        scope: container,
        params: { id: product.id },
        body: { images: [{ url: 'https://cdn.test/b.png' }] },
      }),
    )

    expect(response.status).toBe(200)
    expect(response.json.product.thumbnail).toBe('https://cdn.test/b.png')
    const images = await productService.listProductImages({ productId: product.id })
    expect(images.map((i) => i.url)).toEqual(['https://cdn.test/b.png'])
  })
})

test.describe('POST /admin/products/:id/images/:imageId/variants/batch', () => {
  const batchMatcher = '/admin/products/:id/images/:imageId/variants/batch'

  const createProductWithImageAndVariants = async (dto: { createProduct: () => CreateProductDTO }) => {
    const product = await productService.createProduct({
      ...dto.createProduct(),
      images: [{ url: 'https://cdn.test/a.png' }],
    })
    const [image] = await productService.listProductImages({ productId: product.id })
    const [linked, unlinked] = await productService.createProductVariants([
      { productId: product.id, title: 'Small' },
      { productId: product.id, title: 'Large' },
    ])
    if (!image || !linked || !unlinked) throw new Error('Expected an image and two variants to exist')

    await productService.addImageToVariant([{ imageId: image.id, variantId: linked.id }])
    return { product, image, linked, unlinked }
  }

  test('adds and removes variant associations in one request', async ({ expect, dto }) => {
    const { image, linked, unlinked } = await createProductWithImageAndVariants(dto.generate)
    const handler = applyMiddleware(findDefinition('POST', batchMatcher))

    const response = await handler<typeof imageVariantBatchRoutes.PostOutput>(
      makeRequest({
        scope: container,
        params: { id: image.productId, imageId: image.id },
        body: { add: [unlinked.id], remove: [linked.id] },
      }),
    )

    expect(response.status).toBe(200)
    expect(response.json).toEqual({ added: [unlinked.id], removed: [linked.id] })
    const variantImages = await productService.listProductVariantImages({ imageId: image.id })
    expect(variantImages.map((variantImage) => variantImage.variantId)).toEqual([unlinked.id])
  })

  test('clears the thumbnail of a variant that loses the image', async ({ expect, dto }) => {
    const { image, linked } = await createProductWithImageAndVariants(dto.generate)
    await productService.updateProductVariant(linked.id, { thumbnail: image.url })
    const handler = applyMiddleware(findDefinition('POST', batchMatcher))

    const response = await handler<typeof imageVariantBatchRoutes.PostOutput>(
      makeRequest({
        scope: container,
        params: { id: image.productId, imageId: image.id },
        body: { remove: [linked.id] },
      }),
    )

    expect(response.status).toBe(200)
    expect((await productService.retrieveProductVariant(linked.id)).thumbnail).toBeNull()
  })

  test('leaves a thumbnail pointing at a different image alone', async ({ expect, dto }) => {
    const { image, linked } = await createProductWithImageAndVariants(dto.generate)
    await productService.updateProductVariant(linked.id, { thumbnail: 'https://cdn.test/other.png' })
    const handler = applyMiddleware(findDefinition('POST', batchMatcher))

    await handler<typeof imageVariantBatchRoutes.PostOutput>(
      makeRequest({
        scope: container,
        params: { id: image.productId, imageId: image.id },
        body: { remove: [linked.id] },
      }),
    )

    expect((await productService.retrieveProductVariant(linked.id)).thumbnail).toBe('https://cdn.test/other.png')
  })

  test('reports only the variants that were actually linked', async ({ expect, dto }) => {
    const { image, unlinked } = await createProductWithImageAndVariants(dto.generate)
    const handler = applyMiddleware(findDefinition('POST', batchMatcher))

    const response = await handler<typeof imageVariantBatchRoutes.PostOutput>(
      makeRequest({
        scope: container,
        params: { id: image.productId, imageId: image.id },
        body: { remove: [unlinked.id] },
      }),
    )

    expect(response.json).toEqual({ added: [], removed: [] })
  })
})

test.describe('POST /admin/products/:id/variants/:variantId/images/batch', () => {
  const batchMatcher = '/admin/products/:id/variants/:variantId/images/batch'

  const createVariantWithImages = async (dto: { createProduct: () => CreateProductDTO }) => {
    const product = await productService.createProduct({
      ...dto.createProduct(),
      images: [{ url: 'https://cdn.test/a.png' }, { url: 'https://cdn.test/b.png' }],
    })
    const [linkedImage, unlinkedImage] = await productService.listProductImages(
      { productId: product.id },
      { order: { rank: 'ASC' } },
    )
    const [variant] = await productService.createProductVariants([{ productId: product.id, title: 'Small' }])
    if (!linkedImage || !unlinkedImage || !variant) throw new Error('Expected two images and a variant to exist')

    await productService.addImageToVariant([{ imageId: linkedImage.id, variantId: variant.id }])
    return { product, linkedImage, unlinkedImage, variant }
  }

  test('adds and removes image associations in one request', async ({ expect, dto }) => {
    const { product, linkedImage, unlinkedImage, variant } = await createVariantWithImages(dto.generate)
    const handler = applyMiddleware(findDefinition('POST', batchMatcher))

    const response = await handler<typeof variantImageBatchRoutes.PostOutput>(
      makeRequest({
        scope: container,
        params: { id: product.id, variantId: variant.id },
        body: { add: [unlinkedImage.id], remove: [linkedImage.id] },
      }),
    )

    expect(response.status).toBe(200)
    expect(response.json).toEqual({ added: [unlinkedImage.id], removed: [linkedImage.id] })
    const variantImages = await productService.listProductVariantImages({ variantId: variant.id })
    expect(variantImages.map((variantImage) => variantImage.imageId)).toEqual([unlinkedImage.id])
  })

  test('clears the thumbnail when the variant loses the image it pointed at', async ({ expect, dto }) => {
    const { product, linkedImage, variant } = await createVariantWithImages(dto.generate)
    await productService.updateProductVariant(variant.id, { thumbnail: linkedImage.url })
    const handler = applyMiddleware(findDefinition('POST', batchMatcher))

    await handler<typeof variantImageBatchRoutes.PostOutput>(
      makeRequest({
        scope: container,
        params: { id: product.id, variantId: variant.id },
        body: { remove: [linkedImage.id] },
      }),
    )

    expect((await productService.retrieveProductVariant(variant.id)).thumbnail).toBeNull()
  })

  test('leaves a thumbnail pointing at a still-assigned image alone', async ({ expect, dto }) => {
    const { product, linkedImage, unlinkedImage, variant } = await createVariantWithImages(dto.generate)
    await productService.updateProductVariant(variant.id, { thumbnail: linkedImage.url })
    const handler = applyMiddleware(findDefinition('POST', batchMatcher))

    await handler<typeof variantImageBatchRoutes.PostOutput>(
      makeRequest({
        scope: container,
        params: { id: product.id, variantId: variant.id },
        body: { add: [unlinkedImage.id] },
      }),
    )

    expect((await productService.retrieveProductVariant(variant.id)).thumbnail).toBe(linkedImage.url)
  })

  test('reports only the images that were actually linked', async ({ expect, dto }) => {
    const { product, unlinkedImage, variant } = await createVariantWithImages(dto.generate)
    const handler = applyMiddleware(findDefinition('POST', batchMatcher))

    const response = await handler<typeof variantImageBatchRoutes.PostOutput>(
      makeRequest({
        scope: container,
        params: { id: product.id, variantId: variant.id },
        body: { remove: [unlinkedImage.id] },
      }),
    )

    expect(response.json).toEqual({ added: [], removed: [] })
  })
})

test.describe('GET /admin/products/:id/variants/:variantId', () => {
  test('returns the images assigned to the variant, ordered by rank', async ({ expect, dto }) => {
    const product = await productService.createProduct({
      ...dto.generate.createProduct(),
      images: [{ url: 'https://cdn.test/a.png' }, { url: 'https://cdn.test/b.png' }],
    })
    const images = await productService.listProductImages({ productId: product.id }, { order: { rank: 'ASC' } })
    const [variant] = await productService.createProductVariants([{ productId: product.id, title: 'Small' }])
    const [first, second] = images
    if (!variant || !first || !second) throw new Error('Expected two images and a variant to exist')

    // Linked out of rank order to prove the response is sorted rather than insertion-ordered.
    await productService.addImageToVariant([
      { imageId: second.id, variantId: variant.id },
      { imageId: first.id, variantId: variant.id },
    ])
    const handler = applyMiddleware(findDefinition('GET', '/admin/products/:id/variants/:variantId'))

    const response = await handler<typeof variantByIdRoutes.GetOutput>(
      makeRequest({ scope: container, params: { id: product.id, variantId: variant.id } }),
    )

    expect(response.status).toBe(200)
    expect(response.json.variant.images?.map((image) => image.url)).toEqual([
      'https://cdn.test/a.png',
      'https://cdn.test/b.png',
    ])
  })
})

test.describe('GET /admin/products/:id/images/:imageId/variants', () => {
  const matcher = '/admin/products/:id/images/:imageId/variants'

  const createProductWithTwoImages = async (dto: { createProduct: () => CreateProductDTO }) => {
    const product = await productService.createProduct({
      ...dto.createProduct(),
      images: [{ url: 'https://cdn.test/a.png' }, { url: 'https://cdn.test/b.png' }],
    })
    const [imageA, imageB] = await productService.listProductImages(
      { productId: product.id },
      { order: { rank: 'ASC' } },
    )
    const [linked, unlinked] = await productService.createProductVariants([
      { productId: product.id, title: 'Small' },
      { productId: product.id, title: 'Large' },
    ])
    if (!imageA || !imageB || !linked || !unlinked) throw new Error('Expected two images and two variants to exist')

    return { product, imageA, imageB, linked, unlinked }
  }

  test('returns only the variants the image is assigned to', async ({ expect, dto }) => {
    const { product, imageA, linked } = await createProductWithTwoImages(dto.generate)
    await productService.addImageToVariant([{ imageId: imageA.id, variantId: linked.id }])
    const handler = applyMiddleware(findDefinition('GET', matcher))

    const response = await handler<typeof imageVariantRoutes.GetOutput>(
      makeRequest({ scope: container, params: { id: product.id, imageId: imageA.id } }),
    )

    expect(response.status).toBe(200)
    expect(response.json.variants.map((variant) => variant.id)).toEqual([linked.id])
  })

  test('returns an empty list for an image no variant uses', async ({ expect, dto }) => {
    const { product, imageA } = await createProductWithTwoImages(dto.generate)
    const handler = applyMiddleware(findDefinition('GET', matcher))

    const response = await handler<typeof imageVariantRoutes.GetOutput>(
      makeRequest({ scope: container, params: { id: product.id, imageId: imageA.id } }),
    )

    expect(response.json.variants).toEqual([])
  })

  test('ignores variants linked to a different image', async ({ expect, dto }) => {
    const { product, imageA, imageB, linked, unlinked } = await createProductWithTwoImages(dto.generate)
    await productService.addImageToVariant([
      { imageId: imageA.id, variantId: linked.id },
      { imageId: imageB.id, variantId: unlinked.id },
    ])
    const handler = applyMiddleware(findDefinition('GET', matcher))

    const response = await handler<typeof imageVariantRoutes.GetOutput>(
      makeRequest({ scope: container, params: { id: product.id, imageId: imageB.id } }),
    )

    expect(response.json.variants.map((variant) => variant.id)).toEqual([unlinked.id])
  })
})

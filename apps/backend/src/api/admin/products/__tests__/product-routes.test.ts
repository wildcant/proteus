import type { DbProvider } from '@core/db/ports.js'
import { AppError, ErrorTypes } from '@core/errors/app-error.js'
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
import type * as optionCombinationRoutes from '../[id]/option-combinations/route.js'
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

test.describe('POST /admin/products', () => {
  const createOptions = async (product: { id: string }) => {
    const size = await productService.createProductOption({
      title: `Size-${product.id}`,
      values: [{ value: 'S' }, { value: 'M' }],
    })
    const colour = await productService.createProductOption({
      title: `Colour-${product.id}`,
      values: [{ value: 'Red' }, { value: 'Blue' }],
    })
    return { size, colour }
  }

  test('creates a product with its options and the full variant matrix in one call', async ({ expect, dto }) => {
    // The options have to be linked before a variant can name a combination of them, which is why
    // this is one call rather than the shopkeeper making three.
    const scaffold = await productService.createProduct(dto.generate.createProduct())
    const { size, colour } = await createOptions(scaffold)
    const handler = applyMiddleware(findDefinition('POST', '/admin/products'))

    const response = await handler<typeof productRoutes.PostOutput>(
      makeRequest({
        scope: container,
        body: {
          title: 'Enamel Mug',
          options: [
            { optionId: size.id, valueIds: size.values.map((value) => value.id) },
            { optionId: colour.id, valueIds: colour.values.map((value) => value.id) },
          ],
          variants: size.values.flatMap((sizeValue) =>
            colour.values.map((colourValue) => ({
              optionValues: { [size.id]: sizeValue.id, [colour.id]: colourValue.id },
            })),
          ),
        },
      }),
    )

    expect(response.status).toBe(201)
    const created = response.json.product
    const variants = await productService.listProductVariants({ productId: created.id })
    expect(variants).toHaveLength(4)
    // Titles are derived from the combination, so the shopkeeper never sent one.
    expect(variants.map((variant) => variant.title).sort()).toEqual(['M / Blue', 'M / Red', 'S / Blue', 'S / Red'])
  })

  test('a variant naming a combination the options cannot produce takes the product with it', async ({
    expect,
    dto,
  }) => {
    const scaffold = await productService.createProduct(dto.generate.createProduct())
    const { size, colour } = await createOptions(scaffold)
    const before = await productService.listProducts()
    const handler = applyMiddleware(findDefinition('POST', '/admin/products'))

    const error = await handler<typeof productRoutes.PostOutput>(
      makeRequest({
        scope: container,
        body: {
          title: 'Doomed',
          options: [{ optionId: size.id, valueIds: size.values.map((value) => value.id) }],
          // Names Colour, which this product does not offer.
          variants: [{ optionValues: { [colour.id]: colour.values[0]?.id ?? '' } }],
        },
      }),
    ).catch((e) => e)

    expect(AppError.isError(error)).toBe(true)
    expect(error.type).toBe(ErrorTypes.INVALID_DATA)
    // Compensation ran: no half-built product left behind.
    expect(await productService.listProducts()).toHaveLength(before.length)
  })

  test('a product with no options is created with no variants', async ({ expect }) => {
    const handler = applyMiddleware(findDefinition('POST', '/admin/products'))

    const response = await handler<typeof productRoutes.PostOutput>(
      makeRequest({ scope: container, body: { title: 'Plain' } }),
    )

    expect(response.status).toBe(201)
    expect(await productService.listProductVariants({ productId: response.json.product.id })).toEqual([])
  })
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
      { productId: product.id, optionValues: {} },
      { productId: product.id, optionValues: {} },
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
    const [variant] = await productService.createProductVariants([{ productId: product.id, optionValues: {} }])
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

test.describe('POST /admin/products/:id/variants', () => {
  const matcher = '/admin/products/:id/variants'

  test('a body with no combination never reaches the workflow', async ({ expect, dto }) => {
    const product = await productService.createProduct(dto.generate.createProduct())
    const handler = applyMiddleware(findDefinition('POST', matcher))

    const error = await handler(
      makeRequest({ scope: container, params: { id: product.id }, body: { title: 'Small' } }),
    ).catch((e) => e)

    expect(AppError.isError(error)).toBe(true)
    expect(error.type).toBe(ErrorTypes.INVALID_DATA)
    expect(error.message).toContain('optionValues')
  })
})

test.describe('GET /admin/products/:id/variants/:variantId', () => {
  test('returns the images assigned to the variant, ordered by rank', async ({ expect, dto }) => {
    const product = await productService.createProduct({
      ...dto.generate.createProduct(),
      images: [{ url: 'https://cdn.test/a.png' }, { url: 'https://cdn.test/b.png' }],
    })
    const images = await productService.listProductImages({ productId: product.id }, { order: { rank: 'ASC' } })
    const [variant] = await productService.createProductVariants([{ productId: product.id, optionValues: {} }])
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
      { productId: product.id, optionValues: {} },
      { productId: product.id, optionValues: {} },
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

test.describe('GET /admin/products/:id/option-combinations', () => {
  /** A product offering S/M in one option and Red/Blue in another — four combinations. */
  const createProductWithOptions = async (draft: CreateProductDTO) => {
    const product = await productService.createProduct(draft)
    const size = await productService.createProductOption({
      title: `Size-${product.id}`,
      values: [{ value: 'S' }, { value: 'M' }],
    })
    const colour = await productService.createProductOption({
      title: `Colour-${product.id}`,
      values: [{ value: 'Red' }, { value: 'Blue' }],
    })
    await productService.setProductOptions(product.id, {
      options: [
        { optionId: size.id, valueIds: size.values.map((value) => value.id) },
        { optionId: colour.id, valueIds: colour.values.map((value) => value.id) },
      ],
    })
    return { product, size, colour }
  }

  const listCombinations = (productId: string, query: Record<string, string> = {}) => {
    const handler = applyMiddleware(findDefinition('GET', '/admin/products/:id/option-combinations'))
    return handler<typeof optionCombinationRoutes.GetOutput>(
      makeRequest({ scope: container, params: { id: productId }, query }),
    )
  }

  test('a search that matches nothing still reports the product as having options', async ({ expect, dto }) => {
    const { product } = await createProductWithOptions(dto.generate.createProduct())

    const response = await listCombinations(product.id, { label: 'chartreuse' })

    // The create form reads `totalCombinations`, not `count` — otherwise typing a colour the
    // product does not sell makes it announce that the product has no options at all.
    expect(response.json.count).toBe(0)
    expect(response.json.totalCombinations).toBe(4)
    expect(response.json.availableCombinations).toBe(4)
  })

  test('scope available paginates over the free combinations, not over all of them', async ({ expect, dto }) => {
    const { product, size, colour } = await createProductWithOptions(dto.generate.createProduct())
    const valueId = (option: { values: Array<{ id: string; value: string }> }, value: string) => {
      const match = option.values.find((candidate) => candidate.value === value)
      if (!match) throw new Error(`Expected the option to carry the value "${value}"`)
      return match.id
    }
    await productService.createProductVariant({
      productId: product.id,
      optionValues: { [size.id]: valueId(size, 'S'), [colour.id]: valueId(colour, 'Red') },
    })

    const response = await listCombinations(product.id, { scope: 'available', limit: '2' })

    expect(response.json.combinations).toHaveLength(2)
    expect(response.json.combinations.every((combination) => combination.variantId === null)).toBe(true)
    expect(response.json.count).toBe(3)
    expect(response.json.availableCombinations).toBe(3)
  })

  test('a product with no options reports zero totals', async ({ expect, dto }) => {
    const product = await productService.createProduct(dto.generate.createProduct())

    const response = await listCombinations(product.id)

    expect(response.json.totalCombinations).toBe(0)
    expect(response.json.combinations).toEqual([])
  })
})

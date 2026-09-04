import { BigNumber } from '@core/bignumber.js'
import { ErrorTypes } from '@core/errors/app-error.js'
import type { TestApi } from '@tests/setup/create-api.js'
import { type Fixtures, test } from '@tests/setup/test-extend.js'
import type * as imageVariantBatchRoutes from '../[id]/images/[imageId]/variants/batch/route.js'
import type * as imageVariantRoutes from '../[id]/images/[imageId]/variants/route.js'
import type * as optionCombinationRoutes from '../[id]/option-combinations/route.js'
import type * as productByIdRoutes from '../[id]/route.js'
import type * as variantImageBatchRoutes from '../[id]/variants/[variantId]/images/batch/route.js'
import type * as variantPricesRoutes from '../[id]/variants/[variantId]/prices/route.js'
import type * as variantByIdRoutes from '../[id]/variants/[variantId]/route.js'
import type * as variantRoutes from '../[id]/variants/route.js'
import productDefinitions from '../definitions.js'
import type * as productRoutes from '../route.js'

type Services = Fixtures['service']

let api: TestApi

test.beforeEach(async ({ createApi }) => {
  api = await createApi({ definitions: productDefinitions })
})

/** Size (S/M) and Colour (Red/Blue) as standalone options — four combinations once a product takes both. */
const createOptions = async (service: Services, product: { id: string }) => {
  const size = await service.create.productOption(api.container, {
    title: `Size-${product.id}`,
    values: [{ value: 'S' }, { value: 'M' }],
  })
  const colour = await service.create.productOption(api.container, {
    title: `Colour-${product.id}`,
    values: [{ value: 'Red' }, { value: 'Blue' }],
  })
  return { size, colour }
}

test.describe('POST /admin/products', () => {
  test('creates a product with its options and the full variant matrix in one call', async ({ expect, service }) => {
    // The options have to be linked before a variant can name a combination of them, which is why
    // this is one call rather than the shopkeeper making three.
    const { product: scaffold } = await service.create.product(api.container)
    const { size, colour } = await createOptions(service, scaffold)
    const response = await api.post<typeof productRoutes.PostOutput>('/admin/products', {
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
    })

    expect(response.status).toBe(201)
    const created = response.body.product
    const variants = await service.read.productVariants(api.container, { productId: created.id })
    expect(variants).toHaveLength(4)
    // Titles are derived from the combination, so the shopkeeper never sent one.
    expect(variants.map((variant) => variant.title).sort()).toEqual(['M / Blue', 'M / Red', 'S / Blue', 'S / Red'])
  })

  test('a variant naming a combination the options cannot produce takes the product with it', async ({
    expect,
    service,
  }) => {
    const { product: scaffold } = await service.create.product(api.container)
    const { size, colour } = await createOptions(service, scaffold)
    const before = await service.read.products(api.container)
    const { status, body } = await api.post('/admin/products', {
      title: 'Doomed',
      options: [{ optionId: size.id, valueIds: size.values.map((value) => value.id) }],
      // Names Colour, which this product does not offer.
      variants: [{ optionValues: { [colour.id]: colour.values[0]?.id ?? '' } }],
    })

    expect(status).toBe(400)
    expect(body.type).toBe(ErrorTypes.INVALID_DATA)
    // Compensation ran: no half-built product left behind.
    expect(await service.read.products(api.container)).toHaveLength(before.length)
  })

  test('a product with no options is created with no variants', async ({ expect, service }) => {
    const response = await api.post<typeof productRoutes.PostOutput>('/admin/products', { title: 'Plain' })

    expect(response.status).toBe(201)
    expect(await service.read.productVariants(api.container, { productId: response.body.product.id })).toEqual([])
  })
})

test.describe('GET /admin/products/:id', () => {
  test('returns images ordered by rank', async ({ expect, service }) => {
    const { product } = await service.create.product(api.container, {
      images: [{ url: 'https://cdn.test/a.png' }, { url: 'https://cdn.test/b.png' }],
    })
    const response = await api.get<typeof productByIdRoutes.GetOutput>(`/admin/products/${product.id}`)

    expect(response.status).toBe(200)
    expect(response.body.product.images).toEqual([
      { id: expect.any(String), url: 'https://cdn.test/a.png', rank: 0 },
      { id: expect.any(String), url: 'https://cdn.test/b.png', rank: 1 },
    ])
  })
})

test.describe('GET /admin/products', () => {
  test('returns the thumbnail but no images array', async ({ expect, service }) => {
    await service.create.product(api.container, { images: [{ url: 'https://cdn.test/a.png' }] })
    const response = await api.get<typeof productRoutes.GetOutput>('/admin/products')

    expect(response.status).toBe(200)
    expect(response.body.products[0]?.thumbnail).toBe('https://cdn.test/a.png')
    expect(response.body.products[0]).not.toHaveProperty('images')
  })
})

test.describe('POST /admin/products', () => {
  test('creates the product with its images', async ({ expect, service }) => {
    const response = await api.post<typeof productRoutes.PostOutput>('/admin/products', {
      title: 'Camera',
      images: [{ url: 'https://cdn.test/a.png' }],
    })

    expect(response.status).toBe(201)
    expect(response.body.product.thumbnail).toBe('https://cdn.test/a.png')
    const images = await service.read.productImages(api.container, { productId: response.body.product.id })
    expect(images.map((i) => i.url)).toEqual(['https://cdn.test/a.png'])
  })
})

test.describe('PATCH /admin/products/:id', () => {
  test('replaces the image collection', async ({ expect, service }) => {
    const { product } = await service.create.product(api.container, { images: [{ url: 'https://cdn.test/a.png' }] })
    const response = await api.patch<typeof productByIdRoutes.PatchOutput>(`/admin/products/${product.id}`, {
      images: [{ url: 'https://cdn.test/b.png' }],
    })

    expect(response.status).toBe(200)
    expect(response.body.product.thumbnail).toBe('https://cdn.test/b.png')
    const images = await service.read.productImages(api.container, { productId: product.id })
    expect(images.map((i) => i.url)).toEqual(['https://cdn.test/b.png'])
  })
})

test.describe('POST /admin/products/:id/images/:imageId/variants/batch', () => {
  const createProductWithImageAndVariants = async (service: Services) => {
    const { product, images } = await service.create.product(api.container, {
      images: [{ url: 'https://cdn.test/a.png' }],
    })
    const [image] = images
    const [linked, unlinked] = await service.create.productVariants(api.container, product.id, [{}, {}])
    if (!image || !linked || !unlinked) throw new Error('Expected an image and two variants to exist')

    await service.create.variantImages(api.container, [{ imageId: image.id, variantId: linked.id }])
    return { product, image, linked, unlinked }
  }

  test('adds and removes variant associations in one request', async ({ expect, service }) => {
    const { image, linked, unlinked } = await createProductWithImageAndVariants(service)
    const response = await api.post<typeof imageVariantBatchRoutes.PostOutput>(
      `/admin/products/${image.productId}/images/${image.id}/variants/batch`,
      { add: [unlinked.id], remove: [linked.id] },
    )

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ added: [unlinked.id], removed: [linked.id] })
    const variantImages = await service.read.productVariantImages(api.container, { imageId: image.id })
    expect(variantImages.map((variantImage) => variantImage.variantId)).toEqual([unlinked.id])
  })

  test('clears the thumbnail of a variant that loses the image', async ({ expect, service }) => {
    const { image, linked } = await createProductWithImageAndVariants(service)
    await service.update.productVariant(api.container, linked.id, { thumbnail: image.url })
    const response = await api.post<typeof imageVariantBatchRoutes.PostOutput>(
      `/admin/products/${image.productId}/images/${image.id}/variants/batch`,
      { remove: [linked.id] },
    )

    expect(response.status).toBe(200)
    expect((await service.read.productVariant(api.container, linked.id)).thumbnail).toBeNull()
  })

  test('leaves a thumbnail pointing at a different image alone', async ({ expect, service }) => {
    const { image, linked } = await createProductWithImageAndVariants(service)
    await service.update.productVariant(api.container, linked.id, { thumbnail: 'https://cdn.test/other.png' })
    await api.post<typeof imageVariantBatchRoutes.PostOutput>(
      `/admin/products/${image.productId}/images/${image.id}/variants/batch`,
      { remove: [linked.id] },
    )

    expect((await service.read.productVariant(api.container, linked.id)).thumbnail).toBe('https://cdn.test/other.png')
  })

  test('reports only the variants that were actually linked', async ({ expect, service }) => {
    const { image, unlinked } = await createProductWithImageAndVariants(service)
    const response = await api.post<typeof imageVariantBatchRoutes.PostOutput>(
      `/admin/products/${image.productId}/images/${image.id}/variants/batch`,
      { remove: [unlinked.id] },
    )

    expect(response.body).toEqual({ added: [], removed: [] })
  })
})

test.describe('POST /admin/products/:id/variants/:variantId/images/batch', () => {
  const createVariantWithImages = async (service: Services) => {
    const { product, images } = await service.create.product(api.container, {
      images: [{ url: 'https://cdn.test/a.png' }, { url: 'https://cdn.test/b.png' }],
    })
    const [linkedImage, unlinkedImage] = images
    const [variant] = await service.create.productVariants(api.container, product.id)
    if (!linkedImage || !unlinkedImage || !variant) throw new Error('Expected two images and a variant to exist')

    await service.create.variantImages(api.container, [{ imageId: linkedImage.id, variantId: variant.id }])
    return { product, linkedImage, unlinkedImage, variant }
  }

  test('adds and removes image associations in one request', async ({ expect, service }) => {
    const { product, linkedImage, unlinkedImage, variant } = await createVariantWithImages(service)
    const response = await api.post<typeof variantImageBatchRoutes.PostOutput>(
      `/admin/products/${product.id}/variants/${variant.id}/images/batch`,
      { add: [unlinkedImage.id], remove: [linkedImage.id] },
    )

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ added: [unlinkedImage.id], removed: [linkedImage.id] })
    const variantImages = await service.read.productVariantImages(api.container, { variantId: variant.id })
    expect(variantImages.map((variantImage) => variantImage.imageId)).toEqual([unlinkedImage.id])
  })

  test('clears the thumbnail when the variant loses the image it pointed at', async ({ expect, service }) => {
    const { product, linkedImage, variant } = await createVariantWithImages(service)
    await service.update.productVariant(api.container, variant.id, { thumbnail: linkedImage.url })
    await api.post<typeof variantImageBatchRoutes.PostOutput>(
      `/admin/products/${product.id}/variants/${variant.id}/images/batch`,
      { remove: [linkedImage.id] },
    )

    expect((await service.read.productVariant(api.container, variant.id)).thumbnail).toBeNull()
  })

  test('leaves a thumbnail pointing at a still-assigned image alone', async ({ expect, service }) => {
    const { product, linkedImage, unlinkedImage, variant } = await createVariantWithImages(service)
    await service.update.productVariant(api.container, variant.id, { thumbnail: linkedImage.url })
    await api.post<typeof variantImageBatchRoutes.PostOutput>(
      `/admin/products/${product.id}/variants/${variant.id}/images/batch`,
      { add: [unlinkedImage.id] },
    )

    expect((await service.read.productVariant(api.container, variant.id)).thumbnail).toBe(linkedImage.url)
  })

  test('reports only the images that were actually linked', async ({ expect, service }) => {
    const { product, unlinkedImage, variant } = await createVariantWithImages(service)
    const response = await api.post<typeof variantImageBatchRoutes.PostOutput>(
      `/admin/products/${product.id}/variants/${variant.id}/images/batch`,
      { remove: [unlinkedImage.id] },
    )

    expect(response.body).toEqual({ added: [], removed: [] })
  })
})

test.describe('POST /admin/products/:id/variants', () => {
  test('a body with no combination never reaches the workflow', async ({ expect, service }) => {
    const { product } = await service.create.product(api.container)
    const { status, body } = await api.post(`/admin/products/${product.id}/variants`, { title: 'Small' })

    expect(status).toBe(400)
    expect(body.type).toBe(ErrorTypes.INVALID_DATA)
    expect(body.message).toContain('optionValues')
  })

  test('stores a price per currency the body carries', async ({ expect, service }) => {
    const { product } = await service.create.product(api.container)
    const response = await api.post<typeof variantRoutes.PostOutput>(`/admin/products/${product.id}/variants`, {
      optionValues: {},
      prices: [
        { currencyCode: 'usd', amount: '2800' },
        { currencyCode: 'cop', amount: '12000000' },
      ],
    })

    expect(response.status).toBe(201)
    const prices = response.body.variant.prices ?? []
    expect(
      prices
        .map((price) => ({ currencyCode: price.currencyCode, amount: price.amount }))
        .sort((a, b) => a.currencyCode.localeCompare(b.currencyCode)),
    ).toEqual([
      { currencyCode: 'cop', amount: '12000000' },
      { currencyCode: 'usd', amount: '2800' },
    ])
  })
})

test.describe('GET /admin/products/:id/variants/:variantId', () => {
  test('returns the images assigned to the variant, ordered by rank', async ({ expect, service }) => {
    const { product, images } = await service.create.product(api.container, {
      images: [{ url: 'https://cdn.test/a.png' }, { url: 'https://cdn.test/b.png' }],
    })
    const [variant] = await service.create.productVariants(api.container, product.id)
    const [first, second] = images
    if (!variant || !first || !second) throw new Error('Expected two images and a variant to exist')

    // Linked out of rank order to prove the response is sorted rather than insertion-ordered.
    await service.create.variantImages(api.container, [
      { imageId: second.id, variantId: variant.id },
      { imageId: first.id, variantId: variant.id },
    ])
    const response = await api.get<typeof variantByIdRoutes.GetOutput>(
      `/admin/products/${product.id}/variants/${variant.id}`,
    )

    expect(response.status).toBe(200)
    expect(response.body.variant.images?.map((image) => image.url)).toEqual([
      'https://cdn.test/a.png',
      'https://cdn.test/b.png',
    ])
  })
})

test.describe('GET /admin/products/:id/images/:imageId/variants', () => {
  const createProductWithTwoImages = async (service: Services) => {
    const { product, images } = await service.create.product(api.container, {
      images: [{ url: 'https://cdn.test/a.png' }, { url: 'https://cdn.test/b.png' }],
    })
    const [imageA, imageB] = images
    const [linked, unlinked] = await service.create.productVariants(api.container, product.id, [{}, {}])
    if (!imageA || !imageB || !linked || !unlinked) throw new Error('Expected two images and two variants to exist')

    return { product, imageA, imageB, linked, unlinked }
  }

  test('returns only the variants the image is assigned to', async ({ expect, service }) => {
    const { product, imageA, linked } = await createProductWithTwoImages(service)
    await service.create.variantImages(api.container, [{ imageId: imageA.id, variantId: linked.id }])
    const response = await api.get<typeof imageVariantRoutes.GetOutput>(
      `/admin/products/${product.id}/images/${imageA.id}/variants`,
    )

    expect(response.status).toBe(200)
    expect(response.body.variants.map((variant) => variant.id)).toEqual([linked.id])
  })

  test('returns an empty list for an image no variant uses', async ({ expect, service }) => {
    const { product, imageA } = await createProductWithTwoImages(service)
    const response = await api.get<typeof imageVariantRoutes.GetOutput>(
      `/admin/products/${product.id}/images/${imageA.id}/variants`,
    )

    expect(response.body.variants).toEqual([])
  })

  test('ignores variants linked to a different image', async ({ expect, service }) => {
    const { product, imageA, imageB, linked, unlinked } = await createProductWithTwoImages(service)
    await service.create.variantImages(api.container, [
      { imageId: imageA.id, variantId: linked.id },
      { imageId: imageB.id, variantId: unlinked.id },
    ])
    const response = await api.get<typeof imageVariantRoutes.GetOutput>(
      `/admin/products/${product.id}/images/${imageB.id}/variants`,
    )

    expect(response.body.variants.map((variant) => variant.id)).toEqual([unlinked.id])
  })
})

test.describe('GET /admin/products/:id/option-combinations', () => {
  /** A product offering S/M in one option and Red/Blue in another — four combinations. */
  const createProductWithOptions = async (service: Services) => {
    const { product } = await service.create.product(api.container)
    const { size, colour } = await createOptions(service, product)
    await service.update.productOptions(api.container, product.id, {
      options: [
        { optionId: size.id, valueIds: size.values.map((value) => value.id) },
        { optionId: colour.id, valueIds: colour.values.map((value) => value.id) },
      ],
    })
    return { product, size, colour }
  }

  const listCombinations = (productId: string, query: Record<string, string> = {}) => {
    return api.get<typeof optionCombinationRoutes.GetOutput>(
      `/admin/products/${productId}/option-combinations`,
      undefined,
      { query },
    )
  }

  test('a search that matches nothing still reports the product as having options', async ({ expect, service }) => {
    const { product } = await createProductWithOptions(service)

    const response = await listCombinations(product.id, { label: 'chartreuse' })

    // The create form reads `totalCombinations`, not `count` — otherwise typing a colour the
    // product does not sell makes it announce that the product has no options at all.
    expect(response.body.count).toBe(0)
    expect(response.body.totalCombinations).toBe(4)
    expect(response.body.availableCombinations).toBe(4)
  })

  test('scope available paginates over the free combinations, not over all of them', async ({ expect, service }) => {
    const { product, size, colour } = await createProductWithOptions(service)
    const valueId = (option: { values: Array<{ id: string; value: string }> }, value: string) => {
      const match = option.values.find((candidate) => candidate.value === value)
      if (!match) throw new Error(`Expected the option to carry the value "${value}"`)
      return match.id
    }
    await service.create.productVariant(api.container, product.id, {
      optionValues: { [size.id]: valueId(size, 'S'), [colour.id]: valueId(colour, 'Red') },
    })

    const response = await listCombinations(product.id, { scope: 'available', limit: '2' })

    expect(response.body.combinations).toHaveLength(2)
    expect(response.body.combinations.every((combination) => combination.variantId === null)).toBe(true)
    expect(response.body.count).toBe(3)
    expect(response.body.availableCombinations).toBe(3)
  })

  test('a product with no options reports zero totals', async ({ expect, service }) => {
    const { product } = await service.create.product(api.container)

    const response = await listCombinations(product.id)

    expect(response.body.totalCombinations).toBe(0)
    expect(response.body.combinations).toEqual([])
  })
})

test.describe('PUT /admin/products/:id/variants/:variantId/prices', () => {
  /** A variant priced in both markets — the state a single-currency edit has to leave intact. */
  const createDualPricedVariant = async (service: Services) => {
    const { product } = await service.create.product(api.container)
    const [variant] = await service.create.productVariants(api.container, product.id)
    if (!variant) throw new Error('Expected a variant to exist')

    const [priceSet] = await service.create.variantPrices(api.container, [variant.id], {
      prices: [
        { currencyCode: 'usd', amount: new BigNumber(2800) },
        { currencyCode: 'cop', amount: new BigNumber(12000000) },
      ],
    })
    if (!priceSet) throw new Error('Expected a price set to exist')

    const priceIn = async (currencyCode: string) => {
      const prices = await service.read.prices(api.container, priceSet.id)
      return prices.find((price) => price.currencyCode === currencyCode)
    }

    return { product, variant, priceSet, priceIn }
  }

  test('editing the dollar price leaves the peso price where it was', async ({ expect, service }) => {
    const { product, variant, priceIn } = await createDualPricedVariant(service)
    const before = await priceIn('cop')
    const usd = await priceIn('usd')
    if (!before || !usd) throw new Error('Expected the variant to be priced in both currencies')

    const response = await api.put(`/admin/products/${product.id}/variants/${variant.id}/prices`, {
      prices: [{ id: usd.id, currencyCode: 'usd', amount: '3500' }],
    })

    expect(response.status).toBe(200)
    expect(await priceIn('usd')).toMatchObject({ amount: new BigNumber(3500) })
    // Same row, not a re-created one: a currency the edit never mentioned is not the edit's business.
    expect(await priceIn('cop')).toMatchObject({ id: before.id, amount: before.amount })
  })

  test('editing the peso price leaves the dollar price where it was', async ({ expect, service }) => {
    const { product, variant, priceIn } = await createDualPricedVariant(service)
    const before = await priceIn('usd')
    const cop = await priceIn('cop')
    if (!before || !cop) throw new Error('Expected the variant to be priced in both currencies')

    const response = await api.put(`/admin/products/${product.id}/variants/${variant.id}/prices`, {
      prices: [{ id: cop.id, currencyCode: 'cop', amount: '13500000' }],
    })

    expect(response.status).toBe(200)
    expect(await priceIn('cop')).toMatchObject({ amount: new BigNumber(13500000) })
    expect(await priceIn('usd')).toMatchObject({ id: before.id, amount: before.amount })
  })

  test('adds a currency the variant was not priced in yet', async ({ expect, service }) => {
    const { product } = await service.create.product(api.container)
    const [variant] = await service.create.productVariants(api.container, product.id)
    if (!variant) throw new Error('Expected a variant to exist')

    const response = await api.put<typeof variantPricesRoutes.PutOutput>(
      `/admin/products/${product.id}/variants/${variant.id}/prices`,
      { prices: [{ currencyCode: 'cop', amount: '12000000' }] },
    )

    expect(response.status).toBe(200)
    expect(response.body.variant.prices).toMatchObject([{ currencyCode: 'cop', amount: '12000000' }])
  })

  test('a price with no currency code never reaches the workflow', async ({ expect, service }) => {
    const { product } = await service.create.product(api.container)
    const [variant] = await service.create.productVariants(api.container, product.id)
    if (!variant) throw new Error('Expected a variant to exist')

    const { status, body } = await api.put(`/admin/products/${product.id}/variants/${variant.id}/prices`, {
      prices: [{ amount: '3500' }],
    })

    expect(status).toBe(400)
    expect(body.type).toBe(ErrorTypes.INVALID_DATA)
    expect(body.message).toContain('currencyCode')
  })
})

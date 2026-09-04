import type { TestApi } from '@tests/setup/create-api.js'
import { type Fixtures, test } from '@tests/setup/test-extend.js'
import type * as productByIdRoutes from '../[id]/route.js'
import productDefinitions from '../definitions.js'
import type * as productRoutes from '../route.js'

type Services = Fixtures['service']

let api: TestApi

/**
 * The store's default market, because every route here is priced: with no region to fall back on,
 * `setPricingContext` has no currency to quote and refuses the request before the handler runs.
 * USD is what the price factories write, so these specs read the same as they did when the
 * currency was hardcoded.
 */
test.beforeEach(async ({ createApi, factories }) => {
  api = await createApi({ definitions: productDefinitions })
  const region = await factories.create.region({ name: 'United States', currencyCode: 'usd' })
  await factories.create.store({ defaultRegionId: region.id })
})

test.describe('GET /store/products/:id', () => {
  /**
   * Two images and two variants: the first variant takes both images in reverse rank order to prove
   * the response re-orders them, the second takes none.
   */
  const createProductWithVariantImages = async (service: Services) => {
    const { product, images } = await service.create.product(api.container, {
      images: [{ url: 'https://cdn.test/a.png' }, { url: 'https://cdn.test/b.png' }],
    })
    const [first, second] = images
    const [linked, unlinked] = await service.create.productVariants(api.container, product.id, [{}, {}])
    if (!first || !second || !linked || !unlinked) throw new Error('Expected two images and two variants to exist')

    await service.create.variantImages(api.container, [
      { imageId: second.id, variantId: linked.id },
      { imageId: first.id, variantId: linked.id },
    ])
    await service.create.variantPrices(api.container, [linked.id, unlinked.id])

    return { product, first, second, linked, unlinked }
  }

  test('returns the product images ordered by rank', async ({ expect, service }) => {
    const { product } = await createProductWithVariantImages(service)
    const response = await api.get<typeof productByIdRoutes.GetOutput>(`/store/products/${product.id}`)

    expect(response.status).toBe(200)
    expect(response.body.product.images).toEqual([
      { id: expect.any(String), url: 'https://cdn.test/a.png', rank: 0 },
      { id: expect.any(String), url: 'https://cdn.test/b.png', rank: 1 },
    ])
  })

  test('gives each variant only its own images, in image rank order', async ({ expect, service }) => {
    const { product, first, second, linked, unlinked } = await createProductWithVariantImages(service)
    const response = await api.get<typeof productByIdRoutes.GetOutput>(`/store/products/${product.id}`)

    const imageIdsByVariantId = new Map(response.body.product.variants.map((v) => [v.id, v.imageIds]))
    expect(imageIdsByVariantId.get(linked.id)).toEqual([first.id, second.id])
    expect(imageIdsByVariantId.get(unlinked.id)).toEqual([])
  })

  test('does not leak images linked to a variant of another product', async ({ expect, service }) => {
    const { product, linked } = await createProductWithVariantImages(service)
    const { images: otherImages } = await service.create.product(api.container, {
      images: [{ url: 'https://cdn.test/other.png' }],
    })
    const [otherImage] = otherImages
    if (!otherImage) throw new Error('Expected the other product to have an image')
    await service.create.variantImages(api.container, [{ imageId: otherImage.id, variantId: linked.id }])
    const response = await api.get<typeof productByIdRoutes.GetOutput>(`/store/products/${product.id}`)

    expect(response.body.product.images.map((image) => image.url)).not.toContain('https://cdn.test/other.png')
    const variant = response.body.product.variants.find((v) => v.id === linked.id)
    expect(variant?.imageIds).not.toContain(otherImage.id)
  })

  test('returns no variants for a product that has none', async ({ expect, service }) => {
    const { product } = await service.create.product(api.container)
    const response = await api.get<typeof productByIdRoutes.GetOutput>(`/store/products/${product.id}`)

    expect(response.status).toBe(200)
    expect(response.body.product.variants).toEqual([])
  })
})

test.describe('GET /store/products/:id options', () => {
  /**
   * A product offering Size (S/M) then Colour (Red), with one priced variant per size so the
   * response carries a complete combination for each.
   */
  const createProductWithOptions = async (service: Services) => {
    const { product } = await service.create.product(api.container)
    const size = await service.create.productOption(api.container, {
      title: `Size-${product.id}`,
      renderAs: 'text',
      values: [
        { value: 'S', rank: 0 },
        { value: 'M', rank: 1 },
      ],
    })
    const colour = await service.create.productOption(api.container, {
      title: `Colour-${product.id}`,
      renderAs: 'swatch',
      values: [{ value: 'Red', rank: 0 }],
    })
    await service.update.productOptions(api.container, product.id, {
      options: [
        { optionId: size.id, valueIds: size.values.map((value) => value.id) },
        { optionId: colour.id, valueIds: colour.values.map((value) => value.id) },
      ],
    })

    const valueId = (option: typeof size, value: string) => {
      const match = option.values.find((candidate) => candidate.value === value)
      if (!match) throw new Error(`Expected the option to carry the value "${value}"`)
      return match.id
    }

    const [small, medium] = await service.create.productVariants(api.container, product.id, [
      {
        optionValues: { [size.id]: valueId(size, 'S'), [colour.id]: valueId(colour, 'Red') },
      },
      {
        optionValues: { [size.id]: valueId(size, 'M'), [colour.id]: valueId(colour, 'Red') },
      },
    ])
    if (!small || !medium) throw new Error('Expected two variants to exist')
    await service.create.variantPrices(api.container, [small.id, medium.id])

    return { product, size, colour, small, medium, valueId }
  }

  test('returns the product options in the order they were set, with their render hint', async ({
    expect,
    service,
  }) => {
    const { product, size, colour } = await createProductWithOptions(service)
    const response = await api.get<typeof productByIdRoutes.GetOutput>(`/store/products/${product.id}`)

    expect(response.body.product.options.map((option) => option.id)).toEqual([size.id, colour.id])
    expect(response.body.product.options.map((option) => option.renderAs)).toEqual(['text', 'swatch'])
    expect(response.body.product.options[0]?.values.map((value) => value.value)).toEqual(['S', 'M'])
  })

  test('gives each variant its own Option Combination keyed by option id', async ({ expect, service }) => {
    const { product, size, colour, small, medium, valueId } = await createProductWithOptions(service)
    const response = await api.get<typeof productByIdRoutes.GetOutput>(`/store/products/${product.id}`)

    const combinationByVariantId = new Map(response.body.product.variants.map((v) => [v.id, v.optionValues]))
    expect(combinationByVariantId.get(small.id)).toEqual({
      [size.id]: valueId(size, 'S'),
      [colour.id]: valueId(colour, 'Red'),
    })
    expect(combinationByVariantId.get(medium.id)).toEqual({
      [size.id]: valueId(size, 'M'),
      [colour.id]: valueId(colour, 'Red'),
    })
  })

  test('precomputes where every option value would take the shopper', async ({ expect, service }) => {
    const { product, size, small, medium, valueId } = await createProductWithOptions(service)
    const response = await api.get<typeof productByIdRoutes.GetOutput>(`/store/products/${product.id}`)

    const fromSmall = response.body.product.pickerTargets[small.id]
    // A value pointing at the variant you are on is how the picker knows to render it selected.
    expect(fromSmall?.[valueId(size, 'S')]).toBe(small.id)
    expect(fromSmall?.[valueId(size, 'M')]).toBe(medium.id)
  })

  test('marks a value unreachable when no purchasable variant carries it', async ({ expect, service }) => {
    // The M variant exists but is never priced, so the response drops it — and the picker must not
    // offer a size the shopper cannot actually buy.
    const { product } = await service.create.product(api.container)
    const size = await service.create.productOption(api.container, {
      title: `Size-${product.id}`,
      renderAs: 'text',
      values: [
        { value: 'S', rank: 0 },
        { value: 'M', rank: 1 },
      ],
    })
    await service.update.productOptions(api.container, product.id, {
      options: [{ optionId: size.id, valueIds: size.values.map((value) => value.id) }],
    })
    const idOf = (value: string) => {
      const match = size.values.find((candidate) => candidate.value === value)
      if (!match) throw new Error(`Expected the option to carry the value "${value}"`)
      return match.id
    }
    const [small, medium] = await service.create.productVariants(api.container, product.id, [
      { optionValues: { [size.id]: idOf('S') } },
      { optionValues: { [size.id]: idOf('M') } },
    ])
    if (!small || !medium) throw new Error('Expected two variants to exist')
    await service.create.variantPrices(api.container, [small.id])
    const response = await api.get<typeof productByIdRoutes.GetOutput>(`/store/products/${product.id}`)

    expect(response.body.product.variants.map((variant) => variant.id)).toEqual([small.id])
    expect(response.body.product.pickerTargets[small.id]?.[idOf('M')]).toBeNull()
  })

  test("resolves each value's swatch image from the first variant carrying it", async ({ expect, service }) => {
    // Selection-independent, so the API resolves it once instead of the storefront scanning the
    // variants and joining against the product's images on every render.
    const { product, images } = await service.create.product(api.container, {
      images: [{ url: 'https://cdn.test/red.png' }],
    })
    const [image] = images
    const colour = await service.create.productOption(api.container, {
      title: `Colour-${product.id}`,
      renderAs: 'swatch',
      values: [{ value: 'Red', rank: 0 }],
    })
    await service.update.productOptions(api.container, product.id, {
      options: [{ optionId: colour.id, valueIds: colour.values.map((value) => value.id) }],
    })
    const red = colour.values[0]
    if (!image || !red) throw new Error('Expected an image and an option value to exist')

    const [variant] = await service.create.productVariants(api.container, product.id, [
      { optionValues: { [colour.id]: red.id } },
    ])
    if (!variant) throw new Error('Expected a variant to exist')
    await service.create.variantImages(api.container, [{ imageId: image.id, variantId: variant.id }])
    await service.create.variantPrices(api.container, [variant.id])
    const response = await api.get<typeof productByIdRoutes.GetOutput>(`/store/products/${product.id}`)

    expect(response.body.product.options[0]?.values[0]?.swatchImageUrl).toBe('https://cdn.test/red.png')
  })

  test('leaves the swatch image null when no variant carrying the value has one', async ({ expect, service }) => {
    const { product } = await service.create.product(api.container)
    const colour = await service.create.productOption(api.container, {
      title: `Colour-${product.id}`,
      renderAs: 'swatch',
      values: [{ value: 'Red', rank: 0 }],
    })
    await service.update.productOptions(api.container, product.id, {
      options: [{ optionId: colour.id, valueIds: colour.values.map((value) => value.id) }],
    })
    const red = colour.values[0]
    if (!red) throw new Error('Expected an option value to exist')

    const [variant] = await service.create.productVariants(api.container, product.id, [
      { optionValues: { [colour.id]: red.id } },
    ])
    if (!variant) throw new Error('Expected a variant to exist')
    await service.create.variantPrices(api.container, [variant.id])
    const response = await api.get<typeof productByIdRoutes.GetOutput>(`/store/products/${product.id}`)

    expect(response.body.product.options[0]?.values[0]?.swatchImageUrl).toBeNull()
  })

  test('a product with no options returns none, and its variants carry empty combinations', async ({
    expect,
    service,
  }) => {
    const { product } = await service.create.product(api.container)
    const [variant] = await service.create.productVariants(api.container, product.id)
    if (!variant) throw new Error('Expected a variant to exist')
    await service.create.variantPrices(api.container, [variant.id])
    const response = await api.get<typeof productByIdRoutes.GetOutput>(`/store/products/${product.id}`)

    expect(response.body.product.options).toEqual([])
    expect(response.body.product.variants[0]?.optionValues).toEqual({})
  })

  test('a variant with no inventory link counts as in stock', async ({ expect, service }) => {
    const { product } = await createProductWithOptions(service)
    const response = await api.get<typeof productByIdRoutes.GetOutput>(`/store/products/${product.id}`)

    expect(response.body.product.variants.every((variant) => variant.inStock)).toBe(true)
  })

  test('inStock follows stocked minus reserved against the required quantity', async ({ expect, service }) => {
    const { product, small, medium } = await createProductWithOptions(service)
    await service.create.variantStock(api.container, {
      variantId: small.id,
      item: { sku: `IN-${small.id}`, title: 'in stock' },
      level: { stockedQuantity: 5, reservedQuantity: 1 },
    })
    await service.create.variantStock(api.container, {
      variantId: medium.id,
      item: { sku: `OUT-${medium.id}`, title: 'out of stock' },
      // Everything on hand is already reserved, so nothing is available.
      level: { stockedQuantity: 3, reservedQuantity: 3 },
    })
    const response = await api.get<typeof productByIdRoutes.GetOutput>(`/store/products/${product.id}`)

    const inStockByVariantId = new Map(response.body.product.variants.map((v) => [v.id, v.inStock]))
    expect(inStockByVariantId.get(small.id)).toBe(true)
    expect(inStockByVariantId.get(medium.id)).toBe(false)
  })
})

test.describe('GET /store/products pagination', () => {
  /**
   * Ten published products written in one `createProducts` call. `timestamps` defaults `createdAt`
   * to `now()`, which Postgres resolves to transaction time, so every row here shares one
   * timestamp to the microsecond — the collision an offset pager has to survive.
   */
  const createCollidingCatalogue = async (service: Services) => {
    const products = await service.create.products(
      api.container,
      Array.from({ length: 10 }, () => ({ status: 'published' as const })),
    )
    return products.map((product) => product.id)
  }

  const pageIds = async (query: string) => {
    const response = await api.get<typeof productRoutes.GetOutput>(`/store/products?${query}`)
    return response.body.products.map((product) => product.id)
  }

  test('the seeded catalogue really does share one createdAt', async ({ expect, service }) => {
    // Guards the premise of the test below: if inserts ever stop colliding, the disjointness
    // assertion would start passing for a reason that has nothing to do with the tiebreaker.
    const ids = await createCollidingCatalogue(service)
    const rows = await service.read.products(api.container, { id: ids })

    const timestamps = new Set(rows.map((row) => row.createdAt.getTime()))
    expect(timestamps.size).toBe(1)
  })

  /**
   * The order Postgres itself puts these ids in. Read back through the service rather than sorted
   * in JS, so the expectation uses the database's own collation and cannot disagree with it.
   */
  const idsInTiebreakerOrder = async (service: Services, ids: string[]) => {
    const rows = await service.read.products(api.container, { id: ids }, { order: { id: 'ASC' } })
    return rows.map((row) => row.id)
  }

  test('falls back to the id tiebreaker when every row shares a createdAt', async ({ expect, service }) => {
    const ids = await createCollidingCatalogue(service)
    const expected = await idsInTiebreakerOrder(service, ids)

    // Without a second column there is no usable ORDER BY at all, and the rows come back in
    // insert order — which is what makes this assertion able to fail.
    expect(await pageIds('limit=10&order=-createdAt,id')).toEqual(expected)
  })

  test('two pages follow one total order, so no row repeats or goes missing', async ({ expect, service }) => {
    const ids = await createCollidingCatalogue(service)
    const expected = await idsInTiebreakerOrder(service, ids)

    const first = await pageIds('limit=5&offset=0&order=-createdAt,id')
    const second = await pageIds('limit=5&offset=5&order=-createdAt,id')

    expect(first).toEqual(expected.slice(0, 5))
    expect(second).toEqual(expected.slice(5))
    expect(first.filter((id) => second.includes(id))).toEqual([])
  })

  test('a single-column order still parses the way it always did', async ({ expect, service }) => {
    // Titles are the subject, so they are given rather than faked — and they are plain ASCII so
    // the expected order does not depend on the database's collation.
    await service.create.products(
      api.container,
      ['Charlie', 'Alpha', 'Bravo'].map((title) => ({ title, status: 'published' as const })),
    )

    const response = await api.get<typeof productRoutes.GetOutput>('/store/products?limit=10&order=title')

    expect(response.body.products.map((product) => product.title)).toEqual(['Alpha', 'Bravo', 'Charlie'])
  })
})

import type { ApiErrorBody, TestApi } from '@tests/setup/create-api.js'
import { type Fixtures, test } from '@tests/setup/test-extend.js'
import type * as productByIdRoutes from '../[id]/route.js'
import productDefinitions from '../definitions.js'
import type * as productRoutes from '../route.js'

type Services = Fixtures['service']
type Factories = Fixtures['factories']

let api: TestApi
/** Held for the market specs below, which sell the `us` country through this region. */
let usRegionId: string

/**
 * The store's default market, because every route here is priced: with no region to fall back on,
 * `setPricingContext` has no currency to quote and refuses the request before the handler runs.
 * USD is what the price factories write, so these specs read the same as they did when the
 * currency was hardcoded.
 */
test.beforeEach(async ({ createApi, factories }) => {
  api = await createApi({ definitions: productDefinitions })
  const region = await factories.create.region({ name: 'United States', currencyCode: 'usd' })
  usRegionId = region.id
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
   * The listing carries only what the request's currency can price, so a pager fixture needs a
   * priced variant on every row — an unpriced catalogue leaves no page to assert an order
   * against. The price factory writes USD, which is the currency these specs resolve.
   */
  const priceEveryProduct = async (service: Services, productIds: string[]) => {
    const variants = await Promise.all(
      productIds.map((productId) => service.create.productVariants(api.container, productId)),
    )
    await service.create.variantPrices(
      api.container,
      variants.flat().map((variant) => variant.id),
    )
  }

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
    await priceEveryProduct(
      service,
      products.map((product) => product.id),
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
    const products = await service.create.products(
      api.container,
      ['Charlie', 'Alpha', 'Bravo'].map((title) => ({ title, status: 'published' as const })),
    )
    await priceEveryProduct(
      service,
      products.map((product) => product.id),
    )

    const response = await api.get<typeof productRoutes.GetOutput>('/store/products?limit=10&order=title')

    expect(response.body.products.map((product) => product.title)).toEqual(['Alpha', 'Bravo', 'Charlie'])
  })
})

/**
 * Two markets, and a product each of them can and cannot price.
 *
 * The admin writes one price row per variant, hardcoded to USD, so a product with no price in
 * the shopper's currency is the ordinary outcome for anything a merchant adds — not the
 * impossible one it was while every product had a USD price and every request resolved USD.
 * The seed prices every variant in both currencies, which is exactly why nothing else here
 * sees this.
 */
test.describe('GET /store/products across markets', () => {
  test.beforeEach(async ({ factories }) => {
    await factories.create.country({ id: 'us', regionId: usRegionId, localeCode: 'en-US' })
    const colombia = await factories.create.region({ name: 'Colombia', currencyCode: 'cop' })
    await factories.create.country({ id: 'co', regionId: colombia.id, localeCode: 'es-CO' })
  })

  /**
   * `usdOnly` is what the admin produces today. `bothMarkets` is the seeded shape, and it is the
   * control: it says the filter drops one product rather than emptying the catalogue.
   */
  const createCatalogue = async (factories: Factories) => {
    const usdOnly = await factories.create.productWithPricing({ prices: [{ amount: '100', currencyCode: 'usd' }] })
    const bothMarkets = await factories.create.productWithPricing({
      prices: [
        { amount: '120', currencyCode: 'usd' },
        { amount: '480000', currencyCode: 'cop' },
      ],
    })
    return { usdOnly, bothMarkets }
  }

  test('omits a product the market cannot price', async ({ expect, factories }) => {
    const { usdOnly, bothMarkets } = await createCatalogue(factories)
    const response = await api.get<typeof productRoutes.GetOutput>('/store/products?countryCode=co')

    const ids = response.body.products.map((product) => product.id)
    expect(ids).not.toContain(usdOnly.id)
    expect(ids).toContain(bothMarkets.id)
  })

  test('counts what it returns, so no page promises a row the shopper cannot reach', async ({ expect, factories }) => {
    await createCatalogue(factories)
    const response = await api.get<typeof productRoutes.GetOutput>('/store/products?countryCode=co')

    expect(response.body.count).toBe(1)
    expect(response.body.products).toHaveLength(1)
  })

  test('lists both products in the market both are priced in', async ({ expect, factories }) => {
    const { usdOnly, bothMarkets } = await createCatalogue(factories)
    const response = await api.get<typeof productRoutes.GetOutput>('/store/products?countryCode=us')

    const ids = response.body.products.map((product) => product.id)
    expect(ids).toEqual(expect.arrayContaining([usdOnly.id, bothMarkets.id]))
    expect(response.body.count).toBe(2)
  })

  test("quotes the starting price in each market's own currency", async ({ expect, factories }) => {
    const { bothMarkets } = await createCatalogue(factories)

    const us = await api.get<typeof productRoutes.GetOutput>('/store/products?countryCode=us')
    const co = await api.get<typeof productRoutes.GetOutput>('/store/products?countryCode=co')

    expect(us.body.products.find((product) => product.id === bothMarkets.id)?.startingPrice).toMatchObject({
      currencyCode: 'usd',
      calculatedAmount: '120',
    })
    expect(co.body.products.find((product) => product.id === bothMarkets.id)?.startingPrice).toMatchObject({
      currencyCode: 'cop',
      calculatedAmount: '480000',
    })
  })
})

test.describe('GET /store/products/:id across markets', () => {
  test.beforeEach(async ({ factories }) => {
    await factories.create.country({ id: 'us', regionId: usRegionId, localeCode: 'en-US' })
    const colombia = await factories.create.region({ name: 'Colombia', currencyCode: 'cop' })
    await factories.create.country({ id: 'co', regionId: colombia.id, localeCode: 'es-CO' })
  })

  test('refuses a product with no price in the market, as not-found', async ({ expect, factories }) => {
    // Every variant would be dropped for having no price, leaving a page with no amount, no
    // picker and nothing to add to a cart. The store does not sell it here, so it says so.
    const usdOnly = await factories.create.productWithPricing({ prices: [{ amount: '100', currencyCode: 'usd' }] })
    const response = await api.get<ApiErrorBody>(`/store/products/${usdOnly.id}?countryCode=co`)

    expect(response.status).toBe(404)
    expect(response.body.type).toBe('not_found')
  })

  test('answers an unpriced product exactly as it answers an unknown id', async ({ expect, factories }) => {
    const usdOnly = await factories.create.productWithPricing({ prices: [{ amount: '100', currencyCode: 'usd' }] })

    const unpriced = await api.get<ApiErrorBody>(`/store/products/${usdOnly.id}?countryCode=co`)
    const unknown = await api.get<ApiErrorBody>('/store/products/prod_does_not_exist?countryCode=co')

    expect(unpriced.status).toBe(unknown.status)
    expect(unpriced.body.type).toBe(unknown.body.type)
    expect(unpriced.body.code).toBe(unknown.body.code)
  })

  test('returns the same product in the market it is priced in', async ({ expect, factories }) => {
    const usdOnly = await factories.create.productWithPricing({ prices: [{ amount: '100', currencyCode: 'usd' }] })
    const response = await api.get<typeof productByIdRoutes.GetOutput>(`/store/products/${usdOnly.id}?countryCode=us`)

    expect(response.status).toBe(200)
    expect(response.body.product.variants).toHaveLength(1)
    expect(response.body.product.variants[0]?.calculatedPrice).toMatchObject({
      currencyCode: 'usd',
      calculatedAmount: '100',
    })
  })

  test('a product priced in both markets is unaffected in either', async ({ expect, factories }) => {
    const bothMarkets = await factories.create.productWithPricing({
      prices: [
        { amount: '120', currencyCode: 'usd' },
        { amount: '480000', currencyCode: 'cop' },
      ],
    })

    const us = await api.get<typeof productByIdRoutes.GetOutput>(`/store/products/${bothMarkets.id}?countryCode=us`)
    const co = await api.get<typeof productByIdRoutes.GetOutput>(`/store/products/${bothMarkets.id}?countryCode=co`)

    expect(us.status).toBe(200)
    expect(co.status).toBe(200)
    expect(us.body.product.variants[0]?.calculatedPrice.calculatedAmount).toBe('120')
    expect(co.body.product.variants[0]?.calculatedPrice.calculatedAmount).toBe('480000')
  })
})

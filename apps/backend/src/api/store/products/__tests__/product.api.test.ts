import { BigNumber } from '@core/bignumber.js'
import { Modules } from '@core/utils/modules-definition.js'
import type { ApiErrorBody, TestApi } from '@tests/setup/create-api.js'
import { type Fixtures, test } from '@tests/setup/test-extend.js'
import { vi } from 'vitest'
import catalogStructureDefinitions from '../../../admin/catalog-structure/definitions.js'
import type * as structureRoutes from '../../../admin/catalog-structure/route.js'
import adminCollectionDefinitions from '../../../admin/collections/definitions.js'
import type * as adminCollectionRoutes from '../../../admin/collections/route.js'
import type * as adminOptionRoutes from '../../../admin/product-options/[id]/route.js'
import adminOptionDefinitions from '../../../admin/product-options/definitions.js'
import uploadDefinitions from '../../../admin/uploads/definitions.js'
import type * as uploadRoutes from '../../../admin/uploads/route.js'
import productFilterDefinitions from '../../product-filters/definitions.js'
import type * as productByHandleRoutes from '../[handle]/route.js'
import productDefinitions from '../definitions.js'
import type * as productRoutes from '../route.js'

type Services = Fixtures['service']
type Factories = Fixtures['factories']

let api: TestApi
/** Held for the market specs below, which sell the `us` country through this region. */
let usRegionId: string

/**
 * The store-wide setting a shopkeeper edits in store settings, written the way they would write it.
 *
 * `resolveStore` takes the oldest row, which is the one this file's `beforeEach` creates — so the
 * routes read back exactly what a spec sets here.
 */
const setLowStockThreshold = async (threshold: number | null) => {
  const storeService = api.container.resolve(Modules.STORE)
  const store = await storeService.resolveStore()
  if (!store) throw new Error('Expected the store this suite seeds to exist')
  await storeService.updateStores([store.id], { lowStockThreshold: threshold })
}

/**
 * The store's default market, because every route here is priced: with no region to fall back on,
 * `setPricingContext` has no currency to quote and refuses the request before the handler runs.
 * USD is what the price factories write, so these specs read the same as they did when the
 * currency was hardcoded.
 */
test.beforeEach(async ({ createApi, factories }) => {
  api = await createApi({
    definitions: [
      ...productDefinitions,
      ...productFilterDefinitions,
      ...adminCollectionDefinitions,
      ...adminOptionDefinitions,
      ...catalogStructureDefinitions,
      ...uploadDefinitions,
    ],
  })
  const region = await factories.create.region({ name: 'United States', currencyCode: 'usd' })
  usRegionId = region.id
  await factories.create.store({ defaultRegionId: region.id })
})

test.describe('GET /store/products/:handle', () => {
  /**
   * Two images and two variants: the first variant takes both images in reverse rank order to prove
   * the response re-orders them, the second takes none.
   */
  const createProductWithVariantImages = async (service: Services) => {
    const { product, images } = await service.create.product(api.container, {
      status: 'published',
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
    const response = await api.get<typeof productByHandleRoutes.GetOutput>(`/store/products/${product.handle}`)

    expect(response.status).toBe(200)
    expect(response.body.product.images).toEqual([
      { id: expect.any(String), url: 'https://cdn.test/a.png', rank: 0 },
      { id: expect.any(String), url: 'https://cdn.test/b.png', rank: 1 },
    ])
  })

  test('gives each variant only its own images, in image rank order', async ({ expect, service }) => {
    const { product, first, second, linked, unlinked } = await createProductWithVariantImages(service)
    const response = await api.get<typeof productByHandleRoutes.GetOutput>(`/store/products/${product.handle}`)

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
    const response = await api.get<typeof productByHandleRoutes.GetOutput>(`/store/products/${product.handle}`)

    expect(response.body.product.images.map((image) => image.url)).not.toContain('https://cdn.test/other.png')
    const variant = response.body.product.variants.find((v) => v.id === linked.id)
    expect(variant?.imageIds).not.toContain(otherImage.id)
  })

  test('returns no variants for a product that has none', async ({ expect, service }) => {
    const { product } = await service.create.product(api.container, { status: 'published' })
    const response = await api.get<typeof productByHandleRoutes.GetOutput>(`/store/products/${product.handle}`)

    expect(response.status).toBe(200)
    expect(response.body.product.variants).toEqual([])
  })
})

test.describe('GET /store/products/:handle options', () => {
  /**
   * A product offering Size (S/M) then Colour (Red), with one priced variant per size so the
   * response carries a complete combination for each.
   */
  const createProductWithOptions = async (service: Services) => {
    const { product } = await service.create.product(api.container, { status: 'published' })
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
    const response = await api.get<typeof productByHandleRoutes.GetOutput>(`/store/products/${product.handle}`)

    expect(response.body.product.options.map((option) => option.id)).toEqual([size.id, colour.id])
    expect(response.body.product.options.map((option) => option.renderAs)).toEqual(['text', 'swatch'])
    expect(response.body.product.options[0]?.values.map((value) => value.value)).toEqual(['S', 'M'])
  })

  test('gives each variant its own Option Combination keyed by option id', async ({ expect, service }) => {
    const { product, size, colour, small, medium, valueId } = await createProductWithOptions(service)
    const response = await api.get<typeof productByHandleRoutes.GetOutput>(`/store/products/${product.handle}`)

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
    // Both stocked: the picker only offers a variant a shopper could buy, so a size with nothing
    // behind it would be reported unreachable and this spec would be asserting the wrong thing.
    await service.create.variantStock(api.container, { variantId: small.id, level: { stockedQuantity: 5 } })
    await service.create.variantStock(api.container, { variantId: medium.id, level: { stockedQuantity: 5 } })
    const response = await api.get<typeof productByHandleRoutes.GetOutput>(`/store/products/${product.handle}`)

    const fromSmall = response.body.product.pickerTargets[small.id]
    // A value pointing at the variant you are on is how the picker knows to render it selected.
    expect(fromSmall?.[valueId(size, 'S')]).toBe(small.id)
    expect(fromSmall?.[valueId(size, 'M')]).toBe(medium.id)
  })

  test('marks a value unreachable when no purchasable variant carries it', async ({ expect, service }) => {
    // The M variant exists but is never priced, so the response drops it — and the picker must not
    // offer a size the shopper cannot actually buy.
    const { product } = await service.create.product(api.container, { status: 'published' })
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
    const response = await api.get<typeof productByHandleRoutes.GetOutput>(`/store/products/${product.handle}`)

    expect(response.body.product.variants.map((variant) => variant.id)).toEqual([small.id])
    expect(response.body.product.pickerTargets[small.id]?.[idOf('M')]).toBeNull()
  })

  test("resolves each value's swatch image from the first variant carrying it", async ({ expect, service }) => {
    // Selection-independent, so the API resolves it once instead of the storefront scanning the
    // variants and joining against the product's images on every render.
    const { product, images } = await service.create.product(api.container, {
      status: 'published',
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
    const response = await api.get<typeof productByHandleRoutes.GetOutput>(`/store/products/${product.handle}`)

    expect(response.body.product.options[0]?.values[0]?.swatchImageUrl).toBe('https://cdn.test/red.png')
  })

  test('leaves the swatch image null when no variant carrying the value has one', async ({ expect, service }) => {
    const { product } = await service.create.product(api.container, { status: 'published' })
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
    const response = await api.get<typeof productByHandleRoutes.GetOutput>(`/store/products/${product.handle}`)

    expect(response.body.product.options[0]?.values[0]?.swatchImageUrl).toBeNull()
  })

  test('a product with no options returns none, and its variants carry empty combinations', async ({
    expect,
    service,
  }) => {
    const { product } = await service.create.product(api.container, { status: 'published' })
    const [variant] = await service.create.productVariants(api.container, product.id)
    if (!variant) throw new Error('Expected a variant to exist')
    await service.create.variantPrices(api.container, [variant.id])
    const response = await api.get<typeof productByHandleRoutes.GetOutput>(`/store/products/${product.handle}`)

    expect(response.body.product.options).toEqual([])
    expect(response.body.product.variants[0]?.optionValues).toEqual({})
  })

  /** The shopper-visible answer per variant, which is the only thing these specs assert. */
  const stockByVariantId = async (handle: string) => {
    const response = await api.get<typeof productByHandleRoutes.GetOutput>(`/store/products/${handle}`)
    return new Map(response.body.product.variants.map((variant) => [variant.id, variant.stock]))
  }

  test('an untracked variant and a backorder one both read as available, and never as low', async ({
    expect,
    service,
  }) => {
    // Both are backed by an item holding nothing, so the answer cannot come from an absent number:
    // one is not tracked at all, the other is tracked and sold anyway. The threshold is set, so
    // this also says neither ever earns an "only N left" line.
    await setLowStockThreshold(5)
    const { product, small, medium } = await createProductWithOptions(service)
    await service.update.productVariant(api.container, small.id, { manageInventory: false })
    await service.update.productVariant(api.container, medium.id, { allowBackorder: true })
    await service.create.variantStock(api.container, { variantId: small.id, level: { stockedQuantity: 0 } })
    await service.create.variantStock(api.container, { variantId: medium.id, level: { stockedQuantity: 0 } })

    const stock = await stockByVariantId(product.handle)

    expect(stock.get(small.id)).toEqual({ state: 'available' })
    expect(stock.get(medium.id)).toEqual({ state: 'available' })
  })

  test('a tracked variant with no inventory item reads as sold out', async ({ expect, service }) => {
    // Tracked with nothing behind it. Checkout refuses it as invalid data, so the storefront must
    // not offer it — this is the arrangement that used to be silently sold without limit.
    const { product, small, medium } = await createProductWithOptions(service)
    await service.create.variantStock(api.container, { variantId: small.id, level: { stockedQuantity: 5 } })

    const stock = await stockByVariantId(product.handle)

    expect(stock.get(small.id)).toEqual({ state: 'available' })
    expect(stock.get(medium.id)).toEqual({ state: 'soldOut' })
  })

  test('stocked minus reserved decides the answer: above the threshold available, at it low with the count', async ({
    expect,
    service,
  }) => {
    await setLowStockThreshold(2)
    const { product, small, medium } = await createProductWithOptions(service)
    const plenty = await service.create.variantStock(api.container, {
      variantId: small.id,
      item: { sku: `IN-${small.id}`, title: 'in stock' },
      level: { stockedQuantity: 5 },
    })
    await service.create.reservedStock(api.container, {
      inventoryItemId: plenty.inventoryItem.id,
      locationId: plenty.inventoryLevel.locationId,
      quantity: 1,
    })
    // Stocked at three with one spoken for, so it is the reservation and not the shelf that puts
    // this variant on the threshold.
    const running = await service.create.variantStock(api.container, {
      variantId: medium.id,
      item: { sku: `LOW-${medium.id}`, title: 'running low' },
      level: { stockedQuantity: 3 },
    })
    await service.create.reservedStock(api.container, {
      inventoryItemId: running.inventoryItem.id,
      locationId: running.inventoryLevel.locationId,
      quantity: 1,
    })

    const stock = await stockByVariantId(product.handle)

    expect(stock.get(small.id)).toEqual({ state: 'available' })
    expect(stock.get(medium.id)).toEqual({ state: 'low', remaining: 2 })
  })

  test('sold out wins over low when everything on the shelf is already spoken for', async ({ expect, service }) => {
    // The threshold is high enough to catch zero, so a variant with nothing left has to be refused
    // rather than counted down to. The second variant is the control: same threshold, still low.
    await setLowStockThreshold(5)
    const { product, small, medium } = await createProductWithOptions(service)
    const gone = await service.create.variantStock(api.container, {
      variantId: small.id,
      item: { sku: `OUT-${small.id}`, title: 'sold out' },
      level: { stockedQuantity: 3 },
    })
    await service.create.reservedStock(api.container, {
      inventoryItemId: gone.inventoryItem.id,
      locationId: gone.inventoryLevel.locationId,
      quantity: 3,
    })
    await service.create.variantStock(api.container, {
      variantId: medium.id,
      item: { sku: `LOW-${medium.id}`, title: 'running low' },
      level: { stockedQuantity: 4 },
    })

    const stock = await stockByVariantId(product.handle)

    expect(stock.get(small.id)).toEqual({ state: 'soldOut' })
    expect(stock.get(medium.id)).toEqual({ state: 'low', remaining: 4 })
  })

  test('with no threshold set, one unit left still reads as plainly available', async ({ expect, service }) => {
    // A shop that has never set a threshold is never told a variant is running out — the same one
    // setting silences the shopkeeper's alert and the shopper's "only N left" line. Sold out is not
    // a threshold state, so the second variant still says so.
    await setLowStockThreshold(null)
    const { product, small, medium } = await createProductWithOptions(service)
    await service.create.variantStock(api.container, {
      variantId: small.id,
      item: { sku: `ONE-${small.id}`, title: 'one left' },
      level: { stockedQuantity: 1 },
    })
    await service.create.variantStock(api.container, {
      variantId: medium.id,
      item: { sku: `OUT-${medium.id}`, title: 'sold out' },
      level: { stockedQuantity: 0 },
    })

    const stock = await stockByVariantId(product.handle)

    expect(stock.get(small.id)).toEqual({ state: 'available' })
    expect(stock.get(medium.id)).toEqual({ state: 'soldOut' })
  })
})

test.describe('GET /store/products stock', () => {
  test('a product no variant of which can be bought is sold out, and keeps its place in the list', async ({
    expect,
    service,
  }) => {
    // Not filtered out: unlike a product with no price in this market, which has no amount to draw
    // at all, a sold-out product renders fine — and delisting it would discard an indexed URL.
    const { product: gone } = await service.create.product(api.container, { status: 'published' })
    const { product: stocked } = await service.create.product(api.container, { status: 'published' })
    const [goneVariant] = await service.create.productVariants(api.container, gone.id)
    const [stockedVariant] = await service.create.productVariants(api.container, stocked.id)
    if (!goneVariant || !stockedVariant) throw new Error('Expected a variant on each product')
    await service.create.variantPrices(api.container, [goneVariant.id, stockedVariant.id])
    await service.create.variantStock(api.container, { variantId: goneVariant.id, level: { stockedQuantity: 0 } })
    await service.create.variantStock(api.container, { variantId: stockedVariant.id, level: { stockedQuantity: 4 } })

    const response = await api.get<typeof productRoutes.GetOutput>('/store/products')

    const soldOutByProductId = new Map(response.body.products.map((product) => [product.id, product.soldOut]))
    expect(soldOutByProductId.get(gone.id)).toBe(true)
    expect(soldOutByProductId.get(stocked.id)).toBe(false)
  })

  test('one variant still on the shelf keeps the whole product out of the sold-out state', async ({
    expect,
    service,
  }) => {
    // The product-level answer is "no variant is purchasable", not "some variant is not" — an
    // `Array.some` here would badge a product a shopper can still buy in another size.
    const { product } = await service.create.product(api.container, { status: 'published' })
    const [gone, stocked] = await service.create.productVariants(api.container, product.id, [{}, {}])
    if (!gone || !stocked) throw new Error('Expected two variants to exist')
    await service.create.variantPrices(api.container, [gone.id, stocked.id])
    await service.create.variantStock(api.container, { variantId: gone.id, level: { stockedQuantity: 0 } })
    await service.create.variantStock(api.container, { variantId: stocked.id, level: { stockedQuantity: 2 } })

    const response = await api.get<typeof productRoutes.GetOutput>('/store/products')

    expect(response.body.products.find((candidate) => candidate.id === product.id)?.soldOut).toBe(false)
  })
})

/** A global option with these values in this order, and a lookup from value to id. */
const createOption = async (
  service: Services,
  title: string,
  values: string[],
  listingRole: 'grouping' | 'availability' | null = null,
  buckets: Array<{ name: string; words: string[] }> = [],
) => {
  const option = await service.create.productOption(api.container, {
    title,
    listingRole,
    values: values.map((value, rank) => ({ value, rank })),
    buckets,
  })
  const idOf = (value: string) => {
    const found = option.values.find((candidate) => candidate.value === value)
    if (!found) throw new Error(`No ${title} ${value}`)
    return found.id
  }
  return { id: option.id, idOf, values: option.values }
}

test.describe('GET /store/products card details', () => {
  test('a card wears its Collections’ badges, and lists the in-stock values of its availability option in order', async ({
    expect,
    http,
    service,
  }) => {
    const collection = async (badge: string | null) => {
      const response = await api.post<typeof adminCollectionRoutes.PostOutput>(
        '/admin/collections',
        http.admin.createProductCollection({ badge }),
      )
      expect(response.status).toBe(201)
      return response.body.collection.id
    }
    const [newArrivals, alsoNew, featured] = await Promise.all([collection('new'), collection('new'), collection(null)])
    // Ranked out of text order, so values in option order are not values sorted as strings. Its role is
    // set the way the admin sets it.
    const size = await createOption(service, 'Size', ['9', '10', '11', '12'])
    const role = await api.patch<typeof adminOptionRoutes.PatchOutput>(`/admin/product-options/${size.id}`, {
      listingRole: 'availability',
    })
    expect(role.status).toBe(200)
    expect(role.body.productOption.listingRole).toBe('availability')
    // A second availability option, after Size in the product's order, is not the one the card reads.
    const width = await createOption(service, 'Width', ['Regular', 'Wide'], 'availability')

    const { product: sneaker } = await service.create.product(api.container, {
      status: 'published',
      collectionIds: [newArrivals, alsoNew, featured],
    })
    await service.update.productOptions(api.container, sneaker.id, {
      options: [
        { optionId: size.id, valueIds: ['12', '9', '10', '11'].map(size.idOf) },
        { optionId: width.id, valueIds: [width.idOf('Regular')] },
      ],
    })
    // Created out of size order, and 10 has none left: the card offers 9, 11 and 12.
    const sizes = ['12', '10', '9', '11']
    const sneakerVariants = await service.create.productVariants(
      api.container,
      sneaker.id,
      sizes.map((value) => ({ optionValues: { [size.id]: size.idOf(value), [width.id]: width.idOf('Regular') } })),
    )
    await service.create.variantPrices(
      api.container,
      sneakerVariants.map((variant) => variant.id),
    )
    await Promise.all(
      sneakerVariants.map((variant, index) =>
        service.create.variantStock(api.container, {
          variantId: variant.id,
          level: { stockedQuantity: sizes[index] === '10' ? 0 : 3 },
        }),
      ),
    )

    // In a Collection with no badge, and with no availability option.
    const { product: bag } = await service.create.product(api.container, {
      status: 'published',
      collectionIds: [featured],
    })
    const [bagVariant] = await service.create.productVariants(api.container, bag.id, [{ manageInventory: false }])
    if (!bagVariant) throw new Error('Expected a variant')
    await service.create.variantPrices(api.container, [bagVariant.id])

    const response = await api.get<typeof productRoutes.GetOutput>('/store/products')
    expect(response.status).toBe(200)
    const cardOf = (id: string) => {
      const item = response.body.products.find((product) => product.id === id)
      return item && { badges: item.badges, available: item.available }
    }
    // Two Collections badged `new` give it once.
    expect(cardOf(sneaker.id)).toEqual({ badges: ['new'], available: { option: 'Size', values: ['9', '11', '12'] } })
    expect(cardOf(bag.id)).toEqual({ badges: [], available: null })
  })
})

test.describe('GET /store/products groups', () => {
  test('a card lists its grouping option’s values in order, each with its buckets, its image, its stock and the variant it opens on, and a colour filter opens it on its colourway', async ({
    expect,
    service,
  }) => {
    const colour = await createOption(service, 'Color', ['Black / Red', 'All White', 'Navy'], 'grouping', [
      { name: 'Black', words: ['black'] },
      { name: 'Red', words: ['red'] },
      { name: 'White', words: ['white'] },
    ])
    const size = await createOption(service, 'Size', ['40', '41', '42'])
    // A second grouping option, after Color in the product's order, is not the one the card reads.
    const material = await createOption(service, 'Material', ['Suede'], 'grouping')
    const combination = (value: string, sizeValue: string) => ({
      [colour.id]: colour.idOf(value),
      [size.id]: size.idOf(sizeValue),
      [material.id]: material.idOf('Suede'),
    })
    const { product: suede, images } = await service.create.product(api.container, {
      status: 'published',
      thumbnail: 'https://cdn.test/cover.png',
      images: [
        { url: 'https://cdn.test/cover.png' },
        { url: 'https://cdn.test/red.png' },
        { url: 'https://cdn.test/white.png' },
        { url: 'https://cdn.test/red-back.png' },
      ],
    })
    await service.update.productOptions(api.container, suede.id, {
      options: [
        { optionId: colour.id, valueIds: colour.values.map((value) => value.id) },
        { optionId: size.id, valueIds: size.values.map((value) => value.id) },
        { optionId: material.id, valueIds: [material.idOf('Suede')] },
      ],
    })
    // Created out of the option's order and out of variant order. Of the black-and-red pair's variants
    // the first has no image, so its thumbnail is the second's, not the last's.
    const variants = await service.create.productVariants(api.container, suede.id, [
      { variantRank: 0, optionValues: combination('Navy', '40') },
      { variantRank: 5, optionValues: combination('Black / Red', '42') },
      { variantRank: 2, optionValues: combination('Black / Red', '41') },
      { variantRank: 1, optionValues: combination('Black / Red', '40') },
      { variantRank: 3, optionValues: combination('All White', '40') },
    ])
    const [navy, lastRed, secondRed, firstRed, white] = variants
    const [, redImage, whiteImage, redBackImage] = images
    if (!navy || !lastRed || !secondRed || !firstRed || !white || !redImage || !whiteImage || !redBackImage) {
      throw new Error('Expected five variants and four images')
    }
    await service.create.variantImages(api.container, [
      { variantId: lastRed.id, imageId: redBackImage.id },
      { variantId: secondRed.id, imageId: redImage.id },
      { variantId: white.id, imageId: whiteImage.id },
    ])
    await service.create.variantPrices(
      api.container,
      variants.map((variant) => variant.id),
    )
    // The navy pair and the first black-and-red one are sold out.
    await Promise.all(
      variants.map((variant) =>
        service.create.variantStock(api.container, {
          variantId: variant.id,
          level: { stockedQuantity: variant.id === navy.id || variant.id === firstRed.id ? 0 : 2 },
        }),
      ),
    )
    const { product: plain } = await service.create.product(api.container, { status: 'published' })
    const [plainVariant] = await service.create.productVariants(api.container, plain.id)
    if (!plainVariant) throw new Error('Expected a variant')
    await service.create.variantPrices(api.container, [plainVariant.id])

    const response = await api.get<typeof productRoutes.GetOutput>('/store/products')
    expect(response.status).toBe(200)
    const groupsOf = (id: string) => response.body.products.find((product) => product.id === id)?.groups

    expect(groupsOf(suede.id)).toEqual({
      option: 'Color',
      values: [
        // Each opens the product page on its first variant that can be bought, in variant order; a sold-out
        // value on its first.
        {
          value: 'Black / Red',
          buckets: ['Black', 'Red'],
          thumbnail: 'https://cdn.test/red.png',
          inStock: true,
          variantId: secondRed.id,
        },
        {
          value: 'All White',
          buckets: ['White'],
          thumbnail: 'https://cdn.test/white.png',
          inStock: true,
          variantId: white.id,
        },
        { value: 'Navy', buckets: [], thumbnail: null, inStock: false, variantId: navy.id },
      ],
    })
    expect(groupsOf(plain.id)).toBeNull()

    /** The suede card under a colour filter: the value it opens on and the photo it shows. */
    const openedOn = async (...selections: string[]) => {
      const query = selections.map((selection) => `filter=${encodeURIComponent(`option.Color:${selection}`)}`)
      const filtered = await api.get<typeof productRoutes.GetOutput>(`/store/products?${query.join('&')}`)
      expect(filtered.status).toBe(200)
      const card = filtered.body.products.find((product) => product.id === suede.id)
      return card && { activeGroupValue: card.activeGroupValue, thumbnail: card.thumbnail }
    }
    expect(await openedOn()).toEqual({ activeGroupValue: null, thumbnail: 'https://cdn.test/cover.png' })
    // A bucket opens the card on the first value in it, and its photo.
    expect(await openedOn('Red')).toEqual({ activeGroupValue: 'Black / Red', thumbnail: 'https://cdn.test/red.png' })
    expect(await openedOn('White', 'Black')).toEqual({
      activeGroupValue: 'Black / Red',
      thumbnail: 'https://cdn.test/red.png',
    })
    expect(await openedOn('White')).toEqual({ activeGroupValue: 'All White', thumbnail: 'https://cdn.test/white.png' })
    // A value in no bucket is chosen by itself; with no photo of its own the card keeps the product's.
    expect(await openedOn('Navy')).toEqual({ activeGroupValue: 'Navy', thumbnail: 'https://cdn.test/cover.png' })
  })
})

test.describe('GET /store/products subline', () => {
  test('a card’s subline follows the structure file’s template, field values by their labels, segments missing a value dropped, read once for the page', async ({
    expect,
    service,
  }) => {
    await applyStructure(`
fields:
  - { name: Género, key: genero }
  - { name: Estilo, key: estilo }
categories:
  - { name: Hombre, handle: hombre, rule: { genero: [men] } }
  - { name: Mujer, handle: mujer, rule: { genero: [women] } }
card:
  subline: "{type} para {genero|lower} · {estilo}"
  listSeparator: " y "
`)
    const sneakers = await service.create.productType(api.container, { value: 'Zapatillas' })
    const listed = async (fields: { typeId?: string; metafields?: Record<string, string[]> }) => {
      const { product } = await service.create.product(api.container, { status: 'published', ...fields })
      const variants = await service.create.productVariants(api.container, product.id)
      await service.create.variantPrices(
        api.container,
        variants.map((variant) => variant.id),
      )
      return product.id
    }
    const women = await listed({ typeId: sneakers.id, metafields: { genero: ['women'], estilo: ['clasicos'] } })
    const both = await listed({ typeId: sneakers.id, metafields: { genero: ['men', 'women'] } })
    const noGender = await listed({ typeId: sneakers.id, metafields: { estilo: ['urbano'] } })
    const bare = await listed({})
    const fieldValues = vi.spyOn(api.container.resolve(Modules.PRODUCT), 'listFieldValuesOfProducts')

    const response = await api.get<typeof productRoutes.GetOutput>('/store/products')
    expect(response.status).toBe(200)
    const sublineOf = (id: string) => response.body.products.find((product) => product.id === id)?.subline

    // A value a Category names reads as its name, else capitalised; `|lower` lower-cases it.
    expect(sublineOf(women)).toBe('Zapatillas para mujer · Clasicos')
    // Several values join with the file's separator.
    expect(sublineOf(both)).toBe('Zapatillas para hombre y mujer')
    // No gender: "Zapatillas para" goes whole.
    expect(sublineOf(noGender)).toBe('Urbano')
    expect(sublineOf(bare)).toBeNull()
    // One read for the page's fields, not one per card.
    expect(fieldValues.mock.calls.map(([ids]) => [...ids].sort())).toEqual([[women, both, noGender, bare].sort()])
  })
})

test.describe('GET /store/products sort', () => {
  test('a shopper sorts by price, cheapest or dearest first, page by page, and by relevance to a search', async ({
    expect,
    service,
  }) => {
    /** A product priced per variant; its card's price, and so its place in a price sort, is the cheapest. */
    const product = async (title: string, amounts: number[], brand: string | null = null) => {
      const { product } = await service.create.product(api.container, { title, brand, status: 'published' })
      const variants = await service.create.productVariants(
        api.container,
        product.id,
        amounts.map(() => ({ manageInventory: false })),
      )
      await Promise.all(
        variants.map((variant, index) =>
          service.create.variantPrices(api.container, [variant.id], {
            prices: [{ currencyCode: 'usd', amount: new BigNumber(amounts[index] ?? 0) }],
          }),
        ),
      )
      return product
    }
    // Created one after another, so newest first is the reverse of this order — and of every
    // order asserted below, so none of them can pass by coming back newest first.
    const exact = await product('Samba OG', [300, 250])
    const prefix = await product('Sambarose', [100])
    const inside = await product('Kosamba', [200])
    // Its title leaves the brand out, as catalogues' do.
    const branded = await product('Classic Low', [400], 'Samba')

    const pageOf = async (query: string) => {
      const response = await api.get<typeof productRoutes.GetOutput>(`/store/products?${query}`)
      expect(response.status).toBe(200)
      return { ids: response.body.products.map((item) => item.id), count: response.body.count }
    }

    // The starting price decides: Samba OG's 250, not its 300 — and it is the price the card quotes.
    expect(await pageOf('order=priceAsc')).toEqual({ ids: [prefix.id, inside.id, exact.id, branded.id], count: 4 })
    expect(await pageOf('order=priceDesc')).toEqual({ ids: [branded.id, exact.id, inside.id, prefix.id], count: 4 })
    const cheapest = await api.get<typeof productRoutes.GetOutput>('/store/products?order=priceAsc&limit=3&offset=2')
    expect(cheapest.body.products[0]?.startingPrice).toMatchObject({ calculatedAmount: '250' })
    // Sorted before it is paged, so page two continues the price order rather than sorting itself, and
    // the count is the whole list's.
    expect(await pageOf('order=priceAsc&limit=2')).toEqual({ ids: [prefix.id, inside.id], count: 4 })
    expect(await pageOf('order=priceAsc&limit=2&offset=2')).toEqual({ ids: [exact.id, branded.id], count: 4 })
    // A page past the end still says how long the list is.
    expect(await pageOf('order=priceAsc&limit=2&offset=8')).toEqual({ ids: [], count: 4 })
    // The price range narrows before the page is cut, and the count follows it.
    expect(await pageOf('order=priceAsc&minPrice=150&maxPrice=260&limit=1')).toEqual({ ids: [inside.id], count: 2 })

    // Relevance, the default: a whole title word or the brand first, newest first among them, then the
    // start of a title word, then anywhere inside one.
    expect(await pageOf('q=samba')).toEqual({ ids: [branded.id, exact.id, prefix.id, inside.id], count: 4 })
    // Without a search it is newest first.
    expect(await pageOf('')).toEqual({ ids: [branded.id, inside.id, prefix.id, exact.id], count: 4 })
    expect(await pageOf('order=newest&q=samba')).toEqual({
      ids: [branded.id, inside.id, prefix.id, exact.id],
      count: 4,
    })
    // A column is no longer an order.
    expect((await api.get('/store/products?order=title')).status).toBe(400)
  })

  test('the list and its filters read the page from SQL, never every variant in the catalogue', async ({
    expect,
    service,
  }) => {
    const { product } = await service.create.product(api.container, { status: 'published' })
    const variants = await service.create.productVariants(api.container, product.id)
    await service.create.variantPrices(
      api.container,
      variants.map((variant) => variant.id),
    )
    const listVariants = vi.spyOn(api.container.resolve(Modules.PRODUCT), 'listProductVariants')

    const list = await api.get<typeof productRoutes.GetOutput>('/store/products?order=priceAsc')
    const filters = await api.get('/store/product-filters')

    expect(list.body.products.map((item) => item.id)).toEqual([product.id])
    expect(filters.status).toBe(200)
    // The card's sizes and colourways read the page's own variants, and nothing wider.
    expect(listVariants.mock.calls.map(([filter]) => filter)).toEqual([{ productId: [product.id] }])
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

    // `newest` carries `id` as its tiebreaker. Without it every row ties, and the rows come back in
    // insert order — which is what makes this assertion able to fail.
    expect(await pageIds('limit=10&order=newest')).toEqual(expected)
  })

  test('two pages follow one total order, so no row repeats or goes missing', async ({ expect, service }) => {
    const ids = await createCollidingCatalogue(service)
    const expected = await idsInTiebreakerOrder(service, ids)

    const first = await pageIds('limit=5&offset=0&order=newest')
    const second = await pageIds('limit=5&offset=5&order=newest')

    expect(first).toEqual(expected.slice(0, 5))
    expect(second).toEqual(expected.slice(5))
    expect(first.filter((id) => second.includes(id))).toEqual([])
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

test.describe('GET /store/products/:handle across markets', () => {
  test.beforeEach(async ({ factories }) => {
    await factories.create.country({ id: 'us', regionId: usRegionId, localeCode: 'en-US' })
    const colombia = await factories.create.region({ name: 'Colombia', currencyCode: 'cop' })
    await factories.create.country({ id: 'co', regionId: colombia.id, localeCode: 'es-CO' })
  })

  test('refuses a product with no price in the market, as not-found', async ({ expect, factories }) => {
    // Every variant would be dropped for having no price, leaving a page with no amount, no
    // picker and nothing to add to a cart. The store does not sell it here, so it says so.
    const usdOnly = await factories.create.productWithPricing({ prices: [{ amount: '100', currencyCode: 'usd' }] })
    const response = await api.get<ApiErrorBody>(`/store/products/${usdOnly.handle}?countryCode=co`)

    expect(response.status).toBe(404)
    expect(response.body.type).toBe('not_found')
  })

  test('answers an unpriced product exactly as it answers an unknown handle', async ({ expect, factories }) => {
    const usdOnly = await factories.create.productWithPricing({ prices: [{ amount: '100', currencyCode: 'usd' }] })

    const unpriced = await api.get<ApiErrorBody>(`/store/products/${usdOnly.handle}?countryCode=co`)
    const unknown = await api.get<ApiErrorBody>('/store/products/no-such-product?countryCode=co')

    expect(unpriced.status).toBe(unknown.status)
    expect(unpriced.body.type).toBe(unknown.body.type)
    expect(unpriced.body.code).toBe(unknown.body.code)
  })

  test('answers a product that is not published exactly as it answers an unknown handle', async ({
    expect,
    factories,
  }) => {
    const published = await factories.create.productWithPricing({ prices: [{ amount: '100', currencyCode: 'usd' }] })
    const draft = await factories.create.productWithPricing({
      product: { status: 'draft' },
      prices: [{ amount: '100', currencyCode: 'usd' }],
    })

    const shown = await api.get<typeof productByHandleRoutes.GetOutput>(
      `/store/products/${published.handle}?countryCode=us`,
    )
    const hidden = await api.get<ApiErrorBody>(`/store/products/${draft.handle}?countryCode=us`)
    const unknown = await api.get<ApiErrorBody>('/store/products/no-such-product?countryCode=us')

    // The published twin is what keeps this from passing against a route that answers 404 to everything.
    expect(shown.status).toBe(200)
    expect(hidden.status).toBe(404)
    expect(hidden.body.code).toBe(unknown.body.code)
  })

  test('returns the same product in the market it is priced in', async ({ expect, factories }) => {
    const usdOnly = await factories.create.productWithPricing({ prices: [{ amount: '100', currencyCode: 'usd' }] })
    const response = await api.get<typeof productByHandleRoutes.GetOutput>(
      `/store/products/${usdOnly.handle}?countryCode=us`,
    )

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

    const us = await api.get<typeof productByHandleRoutes.GetOutput>(
      `/store/products/${bothMarkets.handle}?countryCode=us`,
    )
    const co = await api.get<typeof productByHandleRoutes.GetOutput>(
      `/store/products/${bothMarkets.handle}?countryCode=co`,
    )

    expect(us.status).toBe(200)
    expect(co.status).toBe(200)
    expect(us.body.product.variants[0]?.calculatedPrice.calculatedAmount).toBe('120')
    expect(co.body.product.variants[0]?.calculatedPrice.calculatedAmount).toBe('480000')
  })
})

async function applyStructure(text: string) {
  const upload = await api.request
    .post('/admin/uploads')
    .field('access', 'private')
    .attach('files', Buffer.from(text), { filename: 'catalog-structure.yaml', contentType: 'application/yaml' })
  const [file] = (upload.body as typeof uploadRoutes.PostOutput._zod.output).files
  const applied = await api.post<typeof structureRoutes.PostOutput>('/admin/catalog-structure', { fileId: file?.id })
  if (applied.status !== 200) throw new Error(`The structure was not applied: ${JSON.stringify(applied.body)}`)
}

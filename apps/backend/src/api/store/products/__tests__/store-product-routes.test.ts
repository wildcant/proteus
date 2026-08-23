import { BigNumber } from '@core/db/bignum.js'
import type { DbProvider } from '@core/db/ports.js'
import type {
  CreateProductDTO,
  IInventoryModuleService,
  ILinkService,
  IPricingModuleService,
  IProductModuleService,
} from '@core/types/index.js'
import { ContainerRegistrationKeys, Modules } from '@core/utils/index.js'
import { applyMiddleware } from '@framework/http/apply-middleware.js'
import type { RouteDefinition } from '@framework/http/types.js'
import { test } from '@tests/setup/test-extend.js'
import { makeRequest } from '@tests/utils/make-request.js'
import type { AwilixContainer } from 'awilix'
import { bootstrapContainer } from '../../../../container.js'
import type * as productByIdRoutes from '../[id]/route.js'
import productDefinitions from '../definitions.js'

let container: AwilixContainer
let productService: IProductModuleService
let pricingService: IPricingModuleService
let linkService: ILinkService
let inventoryService: IInventoryModuleService

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
  pricingService = container.resolve<IPricingModuleService>(Modules.PRICING)
  linkService = container.resolve<ILinkService>(ContainerRegistrationKeys.LINK)
  inventoryService = container.resolve<IInventoryModuleService>(Modules.INVENTORY)
})

/** The route drops variants with no calculated price, so every variant needs one to show up. */
const priceVariants = async (variantIds: string[]) => {
  const priceSets = await pricingService.createPriceSets(
    variantIds.map(() => ({ prices: [{ currencyCode: 'usd', amount: new BigNumber(2500) }] })),
  )
  await Promise.all(
    variantIds.map((variantId, index) => {
      const priceSet = priceSets[index]
      if (!priceSet) throw new Error(`Missing price set for variant "${variantId}"`)
      return linkService.repo('productVariantPriceSet').create({ variantId, priceSetId: priceSet.id })
    }),
  )
}

test.describe('GET /store/products/:id', () => {
  const matcher = '/store/products/:id'

  /**
   * Two images and two variants: the first variant takes both images in reverse rank order to prove
   * the response re-orders them, the second takes none.
   */
  const createProductWithVariantImages = async (dto: { createProduct: () => CreateProductDTO }) => {
    const product = await productService.createProduct({
      ...dto.createProduct(),
      images: [{ url: 'https://cdn.test/a.png' }, { url: 'https://cdn.test/b.png' }],
    })
    const [first, second] = await productService.listProductImages(
      { productId: product.id },
      { order: { rank: 'ASC' } },
    )
    const [linked, unlinked] = await productService.createProductVariants([
      { productId: product.id, optionValues: {} },
      { productId: product.id, optionValues: {} },
    ])
    if (!first || !second || !linked || !unlinked) throw new Error('Expected two images and two variants to exist')

    await productService.addImageToVariant([
      { imageId: second.id, variantId: linked.id },
      { imageId: first.id, variantId: linked.id },
    ])
    await priceVariants([linked.id, unlinked.id])

    return { product, first, second, linked, unlinked }
  }

  test('returns the product images ordered by rank', async ({ expect, dto }) => {
    const { product } = await createProductWithVariantImages(dto.generate)
    const handler = applyMiddleware(findDefinition('GET', matcher))

    const response = await handler<typeof productByIdRoutes.GetOutput>(
      makeRequest({ scope: container, params: { id: product.id } }),
    )

    expect(response.status).toBe(200)
    expect(response.json.product.images).toEqual([
      { id: expect.any(String), url: 'https://cdn.test/a.png', rank: 0 },
      { id: expect.any(String), url: 'https://cdn.test/b.png', rank: 1 },
    ])
  })

  test('gives each variant only its own images, in image rank order', async ({ expect, dto }) => {
    const { product, first, second, linked, unlinked } = await createProductWithVariantImages(dto.generate)
    const handler = applyMiddleware(findDefinition('GET', matcher))

    const response = await handler<typeof productByIdRoutes.GetOutput>(
      makeRequest({ scope: container, params: { id: product.id } }),
    )

    const imageIdsByVariantId = new Map(response.json.product.variants.map((v) => [v.id, v.imageIds]))
    expect(imageIdsByVariantId.get(linked.id)).toEqual([first.id, second.id])
    expect(imageIdsByVariantId.get(unlinked.id)).toEqual([])
  })

  test('does not leak images linked to a variant of another product', async ({ expect, dto }) => {
    const { product, linked } = await createProductWithVariantImages(dto.generate)
    const other = await productService.createProduct({
      ...dto.generate.createProduct(),
      images: [{ url: 'https://cdn.test/other.png' }],
    })
    const [otherImage] = await productService.listProductImages({ productId: other.id })
    if (!otherImage) throw new Error('Expected the other product to have an image')
    await productService.addImageToVariant([{ imageId: otherImage.id, variantId: linked.id }])
    const handler = applyMiddleware(findDefinition('GET', matcher))

    const response = await handler<typeof productByIdRoutes.GetOutput>(
      makeRequest({ scope: container, params: { id: product.id } }),
    )

    expect(response.json.product.images.map((image) => image.url)).not.toContain('https://cdn.test/other.png')
    const variant = response.json.product.variants.find((v) => v.id === linked.id)
    expect(variant?.imageIds).not.toContain(otherImage.id)
  })

  test('returns no variants for a product that has none', async ({ expect, dto }) => {
    const product = await productService.createProduct(dto.generate.createProduct())
    const handler = applyMiddleware(findDefinition('GET', matcher))

    const response = await handler<typeof productByIdRoutes.GetOutput>(
      makeRequest({ scope: container, params: { id: product.id } }),
    )

    expect(response.status).toBe(200)
    expect(response.json.product.variants).toEqual([])
  })
})

test.describe('GET /store/products/:id options', () => {
  const matcher = '/store/products/:id'

  /**
   * A product offering Size (S/M) then Colour (Red), with one priced variant per size so the
   * response carries a complete combination for each.
   */
  const createProductWithOptions = async (dto: { createProduct: () => CreateProductDTO }) => {
    const product = await productService.createProduct(dto.createProduct())
    const size = await productService.createProductOption({
      title: `Size-${product.id}`,
      values: [
        { value: 'S', rank: 0 },
        { value: 'M', rank: 1 },
      ],
    })
    const colour = await productService.createProductOption({
      title: `Colour-${product.id}`,
      renderAs: 'swatch',
      values: [{ value: 'Red', rank: 0 }],
    })
    await productService.setProductOptions(product.id, {
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

    const [small, medium] = await productService.createProductVariants([
      {
        productId: product.id,
        optionValues: { [size.id]: valueId(size, 'S'), [colour.id]: valueId(colour, 'Red') },
      },
      {
        productId: product.id,
        optionValues: { [size.id]: valueId(size, 'M'), [colour.id]: valueId(colour, 'Red') },
      },
    ])
    if (!small || !medium) throw new Error('Expected two variants to exist')
    await priceVariants([small.id, medium.id])

    return { product, size, colour, small, medium, valueId }
  }

  test('returns the product options in the order they were set, with their render hint', async ({ expect, dto }) => {
    const { product, size, colour } = await createProductWithOptions(dto.generate)
    const handler = applyMiddleware(findDefinition('GET', matcher))

    const response = await handler<typeof productByIdRoutes.GetOutput>(
      makeRequest({ scope: container, params: { id: product.id } }),
    )

    expect(response.json.product.options.map((option) => option.id)).toEqual([size.id, colour.id])
    expect(response.json.product.options.map((option) => option.renderAs)).toEqual(['text', 'swatch'])
    expect(response.json.product.options[0]?.values.map((value) => value.value)).toEqual(['S', 'M'])
  })

  test('gives each variant its own Option Combination keyed by option id', async ({ expect, dto }) => {
    const { product, size, colour, small, medium, valueId } = await createProductWithOptions(dto.generate)
    const handler = applyMiddleware(findDefinition('GET', matcher))

    const response = await handler<typeof productByIdRoutes.GetOutput>(
      makeRequest({ scope: container, params: { id: product.id } }),
    )

    const combinationByVariantId = new Map(response.json.product.variants.map((v) => [v.id, v.optionValues]))
    expect(combinationByVariantId.get(small.id)).toEqual({
      [size.id]: valueId(size, 'S'),
      [colour.id]: valueId(colour, 'Red'),
    })
    expect(combinationByVariantId.get(medium.id)).toEqual({
      [size.id]: valueId(size, 'M'),
      [colour.id]: valueId(colour, 'Red'),
    })
  })

  test('precomputes where every option value would take the shopper', async ({ expect, dto }) => {
    const { product, size, small, medium, valueId } = await createProductWithOptions(dto.generate)
    const handler = applyMiddleware(findDefinition('GET', matcher))

    const response = await handler<typeof productByIdRoutes.GetOutput>(
      makeRequest({ scope: container, params: { id: product.id } }),
    )

    const fromSmall = response.json.product.pickerTargets[small.id]
    // A value pointing at the variant you are on is how the picker knows to render it selected.
    expect(fromSmall?.[valueId(size, 'S')]).toBe(small.id)
    expect(fromSmall?.[valueId(size, 'M')]).toBe(medium.id)
  })

  test('marks a value unreachable when no purchasable variant carries it', async ({ expect, dto }) => {
    // The M variant exists but is never priced, so the response drops it — and the picker must not
    // offer a size the shopper cannot actually buy.
    const product = await productService.createProduct(dto.generate.createProduct())
    const size = await productService.createProductOption({
      title: `Size-${product.id}`,
      values: [
        { value: 'S', rank: 0 },
        { value: 'M', rank: 1 },
      ],
    })
    await productService.setProductOptions(product.id, {
      options: [{ optionId: size.id, valueIds: size.values.map((value) => value.id) }],
    })
    const idOf = (value: string) => {
      const match = size.values.find((candidate) => candidate.value === value)
      if (!match) throw new Error(`Expected the option to carry the value "${value}"`)
      return match.id
    }
    const [small, medium] = await productService.createProductVariants([
      { productId: product.id, optionValues: { [size.id]: idOf('S') } },
      { productId: product.id, optionValues: { [size.id]: idOf('M') } },
    ])
    if (!small || !medium) throw new Error('Expected two variants to exist')
    await priceVariants([small.id])
    const handler = applyMiddleware(findDefinition('GET', matcher))

    const response = await handler<typeof productByIdRoutes.GetOutput>(
      makeRequest({ scope: container, params: { id: product.id } }),
    )

    expect(response.json.product.variants.map((variant) => variant.id)).toEqual([small.id])
    expect(response.json.product.pickerTargets[small.id]?.[idOf('M')]).toBeNull()
  })

  test("resolves each value's swatch image from the first variant carrying it", async ({ expect, dto }) => {
    // Selection-independent, so the API resolves it once instead of the storefront scanning the
    // variants and joining against the product's images on every render.
    const product = await productService.createProduct({
      ...dto.generate.createProduct(),
      images: [{ url: 'https://cdn.test/red.png' }],
    })
    const [image] = await productService.listProductImages({ productId: product.id })
    const colour = await productService.createProductOption({
      title: `Colour-${product.id}`,
      renderAs: 'swatch',
      values: [{ value: 'Red', rank: 0 }],
    })
    await productService.setProductOptions(product.id, {
      options: [{ optionId: colour.id, valueIds: colour.values.map((value) => value.id) }],
    })
    const red = colour.values[0]
    if (!image || !red) throw new Error('Expected an image and an option value to exist')

    const [variant] = await productService.createProductVariants([
      { productId: product.id, optionValues: { [colour.id]: red.id } },
    ])
    if (!variant) throw new Error('Expected a variant to exist')
    await productService.addImageToVariant([{ imageId: image.id, variantId: variant.id }])
    await priceVariants([variant.id])
    const handler = applyMiddleware(findDefinition('GET', matcher))

    const response = await handler<typeof productByIdRoutes.GetOutput>(
      makeRequest({ scope: container, params: { id: product.id } }),
    )

    expect(response.json.product.options[0]?.values[0]?.swatchImageUrl).toBe('https://cdn.test/red.png')
  })

  test('leaves the swatch image null when no variant carrying the value has one', async ({ expect, dto }) => {
    const product = await productService.createProduct(dto.generate.createProduct())
    const colour = await productService.createProductOption({
      title: `Colour-${product.id}`,
      renderAs: 'swatch',
      values: [{ value: 'Red', rank: 0 }],
    })
    await productService.setProductOptions(product.id, {
      options: [{ optionId: colour.id, valueIds: colour.values.map((value) => value.id) }],
    })
    const red = colour.values[0]
    if (!red) throw new Error('Expected an option value to exist')

    const [variant] = await productService.createProductVariants([
      { productId: product.id, optionValues: { [colour.id]: red.id } },
    ])
    if (!variant) throw new Error('Expected a variant to exist')
    await priceVariants([variant.id])
    const handler = applyMiddleware(findDefinition('GET', matcher))

    const response = await handler<typeof productByIdRoutes.GetOutput>(
      makeRequest({ scope: container, params: { id: product.id } }),
    )

    expect(response.json.product.options[0]?.values[0]?.swatchImageUrl).toBeNull()
  })

  test('a product with no options returns none, and its variants carry empty combinations', async ({ expect, dto }) => {
    const product = await productService.createProduct(dto.generate.createProduct())
    const [variant] = await productService.createProductVariants([{ productId: product.id, optionValues: {} }])
    if (!variant) throw new Error('Expected a variant to exist')
    await priceVariants([variant.id])
    const handler = applyMiddleware(findDefinition('GET', matcher))

    const response = await handler<typeof productByIdRoutes.GetOutput>(
      makeRequest({ scope: container, params: { id: product.id } }),
    )

    expect(response.json.product.options).toEqual([])
    expect(response.json.product.variants[0]?.optionValues).toEqual({})
  })

  test('a variant with no inventory link counts as in stock', async ({ expect, dto }) => {
    const { product } = await createProductWithOptions(dto.generate)
    const handler = applyMiddleware(findDefinition('GET', matcher))

    const response = await handler<typeof productByIdRoutes.GetOutput>(
      makeRequest({ scope: container, params: { id: product.id } }),
    )

    expect(response.json.product.variants.every((variant) => variant.inStock)).toBe(true)
  })

  test('inStock follows stocked minus reserved against the required quantity', async ({ expect, dto }) => {
    const { product, small, medium } = await createProductWithOptions(dto.generate)
    const [stocked, exhausted] = await inventoryService.createInventoryItems([
      { sku: `IN-${small.id}`, title: 'in stock', requiresShipping: true },
      { sku: `OUT-${medium.id}`, title: 'out of stock', requiresShipping: true },
    ])
    if (!stocked || !exhausted) throw new Error('Expected two inventory items to exist')
    await inventoryService.createInventoryLevels([
      { inventoryItemId: stocked.id, locationId: 'loc_test', stockedQuantity: 5, reservedQuantity: 1 },
      // Everything on hand is already reserved, so nothing is available.
      { inventoryItemId: exhausted.id, locationId: 'loc_test', stockedQuantity: 3, reservedQuantity: 3 },
    ])
    await linkService.repo('productVariantInventoryItem').createMany([
      { variantId: small.id, inventoryItemId: stocked.id },
      { variantId: medium.id, inventoryItemId: exhausted.id },
    ])
    const handler = applyMiddleware(findDefinition('GET', matcher))

    const response = await handler<typeof productByIdRoutes.GetOutput>(
      makeRequest({ scope: container, params: { id: product.id } }),
    )

    const inStockByVariantId = new Map(response.json.product.variants.map((v) => [v.id, v.inStock]))
    expect(inStockByVariantId.get(small.id)).toBe(true)
    expect(inStockByVariantId.get(medium.id)).toBe(false)
  })
})

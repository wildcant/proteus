import { BigNumber } from '@core/db/bignum.js'
import type { DbProvider } from '@core/db/ports.js'
import type { CreateProductDTO, ILinkService, IPricingModuleService, IProductModuleService } from '@core/types/index.js'
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
      { productId: product.id, title: 'Small' },
      { productId: product.id, title: 'Medium' },
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

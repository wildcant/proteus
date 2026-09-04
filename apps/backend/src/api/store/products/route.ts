import { AppError, ErrorTypes } from '@core/errors/index.js'
import type { ILinkService, IPricingModuleService, IProductModuleService } from '@core/types/index.js'
import { ContainerRegistrationKeys, Modules } from '@core/utils/index.js'
import { StoreProductListParams, StoreProductListResponse } from '@proteus/http-schemas/store'
import type { HttpRequest, HttpResult } from '../../../server/ports.js'
import { buildStartingPrices } from '../../../workflows/product/utils/build-starting-prices.js'

export const GetInput = { query: StoreProductListParams }
export const GetOutput = StoreProductListResponse

export const GET = async (req: HttpRequest<typeof GetInput>): Promise<HttpResult<typeof GetOutput>> => {
  const productService = req.scope.resolve<IProductModuleService>(Modules.PRODUCT)
  const pricingService = req.scope.resolve<IPricingModuleService>(Modules.PRICING)
  const linkService = req.scope.resolve<ILinkService>(ContainerRegistrationKeys.LINK)

  if (!req.pricingContext) {
    throw new AppError({
      type: ErrorTypes.UNEXPECTED_STATE,
      message: 'pricingContext missing — setPricingContext middleware not applied',
    })
  }

  const { pagination, filters } = req.validatedQuery
  const { offset, limit } = pagination

  /**
   * Pricing decides the catalogue, so it is resolved before the page is drawn rather than after.
   *
   * The admin writes one price row per variant in one currency, so a product the store cannot
   * quote in this market is now an ordinary occurrence rather than an impossible one — and a
   * shopper is shown no card rather than a card with no price. Filtering an already-paged result
   * would hide the product but leave `count` promising rows no page can reach and pages shorter
   * than the `limit` they were asked for; restricting the query itself keeps `count`, `offset`
   * and `limit` describing the list that actually comes back.
   *
   * Same number of round trips as paging first — the variants, links and prices this reads are
   * the ones the response needs anyway — over the whole catalogue rather than one page of it.
   */
  const variants = await productService.listProductVariants()
  const links = await linkService.repo('productVariantPriceSet').findByVariantIds(variants.map((variant) => variant.id))

  const priceSetIds = [...new Set(links.map((link) => link.priceSetId))]
  const calculatedPrices = await pricingService.calculatePrices(priceSetIds, req.pricingContext)

  const startingPriceByProductId = buildStartingPrices(variants, links, calculatedPrices)
  const sellableProductIds = [...startingPriceByProductId.keys()]

  // An empty filter array would reach the query builder as `inArray(column, [])`, and a market
  // that can price nothing has no page to draw either way.
  if (sellableProductIds.length === 0) return { status: 200, json: { products: [], count: 0, offset, limit } }

  const [products, count] = await productService.listAndCountProducts(
    { ...filters, status: 'published', id: sellableProductIds },
    pagination,
  )

  const enrichedProducts = products.map((product) => ({
    ...product,
    startingPrice: startingPriceByProductId.get(product.id),
  }))

  return { status: 200, json: { products: enrichedProducts, count, offset, limit } }
}

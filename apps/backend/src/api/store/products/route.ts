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
  const [products, count] = await productService.listAndCountProducts({ ...filters, status: 'published' }, pagination)
  const { offset, limit } = pagination

  const productIds = products.map((product) => product.id)
  const variants = await productService.listProductVariants({ productId: productIds })

  const variantIds = variants.map((variant) => variant.id)
  const links = await linkService.repo('productVariantPriceSet').findByVariantIds(variantIds)

  const priceSetIds = [...new Set(links.map((link) => link.priceSetId))]
  const calculatedPrices = await pricingService.calculatePrices(priceSetIds, req.pricingContext)

  const startingPriceByProductId = buildStartingPrices(variants, links, calculatedPrices)

  const enrichedProducts = products.map((product) => ({
    ...product,
    startingPrice: startingPriceByProductId.get(product.id),
  }))

  return { status: 200, json: { products: enrichedProducts, count, offset, limit } }
}

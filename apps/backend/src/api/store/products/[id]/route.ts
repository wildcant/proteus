import { AppError, ErrorTypes } from '@core/errors/index.js'
import type { ILinkService, IPricingModuleService, IProductModuleService } from '@core/types/index.js'
import { ContainerRegistrationKeys, Modules } from '@core/utils/index.js'
import { IdParams, StoreProductResponse } from '@proteus/http-schemas/store'
import type { HttpRequest, HttpResult } from '../../../../server/ports.js'
import { buildVariantPrices } from '../../../../workflows/product/utils/build-variant-prices.js'

export const GetInput = { params: IdParams }
export const GetOutput = StoreProductResponse

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

  const [product, variants] = await Promise.all([
    productService.retrieveProduct(req.params.id),
    productService.listProductVariants({ productId: req.params.id }),
  ])

  const variantIds = variants.map((variant) => variant.id)
  const links = await linkService.repo('productVariantPriceSet').findByVariantIds(variantIds)

  const priceSetIds = [...new Set(links.map((link) => link.priceSetId))]
  const calculatedPrices = await pricingService.calculatePrices(priceSetIds, req.pricingContext)

  const priceByVariantId = buildVariantPrices(links, calculatedPrices)

  const enrichedVariants = variants.flatMap((variant) => {
    const calculatedPrice = priceByVariantId.get(variant.id)
    if (!calculatedPrice) return []
    return { ...variant, calculatedPrice }
  })

  return { status: 200, json: { product: { ...product, variants: enrichedVariants } } }
}

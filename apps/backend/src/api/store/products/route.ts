import type { BigNumber } from '@core/db/bignum.js'
import { AppError, ErrorTypes } from '@core/errors/index.js'
import type { ILinkService, IPricingModuleService, IProductModuleService } from '@core/types/index.js'
import { ContainerRegistrationKeys, Modules } from '@core/utils/index.js'
import { StoreProductListParams, StoreProductListResponse } from '@proteus/http-schemas/store'
import type { HttpRequest, HttpResult } from '../../../server/ports.js'

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
  const variants = productIds.length > 0 ? await productService.listProductVariants({ productId: productIds }) : []

  const variantIds = variants.map((variant) => variant.id)
  const variantAndPriceSetLinks = await linkService.repo('productVariantPriceSet').findByVariantIds(variantIds)

  const variantToPriceSetId = new Map(variantAndPriceSetLinks.map((link) => [link.variantId, link.priceSetId]))
  const priceSetIds = [...new Set(variantToPriceSetId.values())]

  const calculatedPrices =
    priceSetIds.length > 0 ? await pricingService.calculatePrices(priceSetIds, req.pricingContext) : []

  const calculatedPriceBySetId = new Map(calculatedPrices.map((price) => [price.id, price]))

  // Build a map of productId → cheapest calculated price
  const startingPriceByProductId = new Map<string, { id: string; currencyCode: string; originalAmount: BigNumber }>()
  for (const variant of variants) {
    const priceSetId = variantToPriceSetId.get(variant.id)
    if (!priceSetId) continue

    const calculated = calculatedPriceBySetId.get(priceSetId)
    if (!calculated?.calculatedAmount || !calculated.currencyCode) continue

    const existing = startingPriceByProductId.get(variant.productId)
    if (!existing || calculated.calculatedAmount.isLessThan(existing.originalAmount)) {
      startingPriceByProductId.set(variant.productId, {
        id: calculated.id,
        currencyCode: calculated.currencyCode,
        originalAmount: calculated.calculatedAmount,
      })
    }
  }

  const enrichedProducts = products.map((product) => ({
    ...product,
    startingPrice: startingPriceByProductId.get(product.id),
  }))

  return { status: 200, json: { products: enrichedProducts, count, offset, limit } }
}

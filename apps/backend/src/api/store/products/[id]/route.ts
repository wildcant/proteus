import { AppError, ErrorTypes } from '@core/errors/app-error.js'
import { ContainerRegistrationKeys } from '@core/utils/container.js'
import { Modules } from '@core/utils/modules-definition.js'
import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import { IdParams, StorePricingContextParams, StoreProductResponse } from '@proteus/http-schemas/store'
import { buildOptionSwatches } from '@workflows/product/utils/build-option-swatches.js'
import { buildVariantPrices } from '@workflows/product/utils/build-variant-prices.js'
import {
  buildAvailableQuantities,
  isPurchasable,
  variantStockProjection,
} from '@workflows/product/utils/build-variant-stock.js'
import { setPricingContext } from '../../middlewares.js'

export const GetInput = { params: IdParams, contextQuery: StorePricingContextParams }
export const GetMiddlewares = [setPricingContext()] as const
export const GetOutput = StoreProductResponse
/**
 * A product the market cannot price is not a product this market has. The 404 says so directly
 * rather than answering with a variant list the storefront has no price to render.
 */
export const GetThrows = [ErrorTypes.NOT_FOUND] as const

export const GET = async (
  req: HttpRequest<typeof GetInput, typeof GetMiddlewares>,
): Promise<HttpResult<typeof GetOutput>> => {
  const productService = req.scope.resolve(Modules.PRODUCT)
  const pricingService = req.scope.resolve(Modules.PRICING)
  const inventoryService = req.scope.resolve(Modules.INVENTORY)
  const storeService = req.scope.resolve(Modules.STORE)
  const linkService = req.scope.resolve(ContainerRegistrationKeys.LINK)

  const [product, variants, images, options] = await Promise.all([
    productService.retrieveProduct(req.params.id),
    productService.listProductVariants({ productId: req.params.id }),
    productService.listProductImages({ productId: req.params.id }, { order: { rank: 'ASC' } }),
    productService.listProductOptionsForProduct(req.params.id),
  ])

  const variantIds = variants.map((variant) => variant.id)
  const [links, variantImages, optionValuesByVariantId, inventoryLinks] = await Promise.all([
    linkService.repo('productVariantPriceSet').findByVariantIds(variantIds),
    // An empty filter array would reach the query builder as `inArray(column, [])`.
    variantIds.length > 0 ? productService.listProductVariantImages({ variantId: variantIds }) : [],
    // The lean id map rather than `enrichVariants`: the picker only compares ids, and the labels
    // already ship once on `product.options`.
    productService.listVariantOptionMaps(variantIds),
    linkService.repo('productVariantInventoryItem').findByVariantIds(variantIds),
  ])

  const priceSetIds = [...new Set(links.map((link) => link.priceSetId))]
  const calculatedPrices = await pricingService.calculatePrices(priceSetIds, req.pricingContext)

  const priceByVariantId = buildVariantPrices(links, calculatedPrices)

  const linkedImages = new Set(variantImages.map((variantImage) => `${variantImage.variantId}:${variantImage.imageId}`))

  const itemIds = [...new Set(inventoryLinks.map((link) => link.inventoryItemId))]
  const [levels, store] = await Promise.all([
    // Every item's levels in one read, the way the cart workflows read them — asking the module
    // per item would be one `SELECT` per variant. An empty filter array would reach the query
    // builder as `inArray(column, [])`.
    itemIds.length > 0 ? inventoryService.listInventoryLevels({ inventoryItemId: itemIds }) : [],
    // The threshold that decides `low` is store-wide and nullable, and a deployment with no store
    // row yet has no threshold — which reads the same way an unset one does: no variant is low.
    storeService.resolveStore(),
  ])
  const stockOf = variantStockProjection(
    inventoryLinks,
    buildAvailableQuantities(levels),
    store?.lowStockThreshold ?? null,
  )

  const variantsForResponse = variants.flatMap((variant) => {
    const calculatedPrice = priceByVariantId.get(variant.id)
    if (!calculatedPrice) return []
    // Filtering the rank-ordered images means `imageIds` inherits that order for free.
    const imageIds = images.filter((image) => linkedImages.has(`${variant.id}:${image.id}`)).map((image) => image.id)
    return {
      ...variant,
      imageIds,
      stock: stockOf(variant),
      optionValues: optionValuesByVariantId[variant.id] ?? {},
      calculatedPrice,
    }
  })

  /**
   * A product whose every variant was dropped for having no price in this market has nothing to
   * show and nothing to buy: no amount, no option picker, no add-to-cart. The store cannot sell
   * it here, so it answers the way it answers for a product it does not have — the refusal
   * `retrieveProduct` already raises for an unknown id, so this route has one not-found and not
   * two.
   *
   * Guarded on the product having had variants at all, so a product with none keeps answering
   * exactly as it did: that is a different shape (nothing to price) and not this finding.
   */
  if (variants.length > 0 && variantsForResponse.length === 0) {
    throw new AppError({
      type: ErrorTypes.NOT_FOUND,
      message: `Product with id "${req.params.id}" has no price in ${req.pricingContext.currencyCode}`,
    })
  }

  // Built from the variants actually being shipped, so the picker never offers one the response
  // dropped for having no price. It keeps a boolean, because striking a value through is a yes/no
  // question — but one derived from the same projection the response carries rather than from a
  // field on the wire, so what the picker crosses out and what the button refuses cannot disagree.
  const pickerTargets = await productService.buildProductPickerTargets(
    req.params.id,
    variantsForResponse.map((variant) => ({
      id: variant.id,
      optionValues: variant.optionValues,
      inStock: isPurchasable(variant.stock),
    })),
  )

  // Built from the same shipped variants as the picker, so a swatch can never point at an image
  // belonging to a variant the response dropped.
  const swatchUrlByValueId = buildOptionSwatches(options, variantsForResponse, images)
  const optionsForResponse = options.map((option) => ({
    ...option,
    values: option.values.map((value) => ({ ...value, swatchImageUrl: swatchUrlByValueId[value.id] ?? null })),
  }))

  return {
    status: 200,
    json: {
      product: { ...product, images, options: optionsForResponse, variants: variantsForResponse, pickerTargets },
    },
  }
}

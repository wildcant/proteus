import { AppError, ErrorTypes } from '@core/errors/index.js'
import type {
  IInventoryModuleService,
  ILinkService,
  IPricingModuleService,
  IProductModuleService,
} from '@core/types/index.js'
import { ContainerRegistrationKeys, Modules } from '@core/utils/index.js'
import { IdParams, StoreProductResponse } from '@proteus/http-schemas/store'
import type { HttpRequest, HttpResult } from '../../../../server/ports.js'
import { buildVariantPrices } from '../../../../workflows/product/utils/build-variant-prices.js'
import { buildVariantStock } from '../../../../workflows/product/utils/build-variant-stock.js'

export const GetInput = { params: IdParams }
export const GetOutput = StoreProductResponse

export const GET = async (req: HttpRequest<typeof GetInput>): Promise<HttpResult<typeof GetOutput>> => {
  const productService = req.scope.resolve<IProductModuleService>(Modules.PRODUCT)
  const pricingService = req.scope.resolve<IPricingModuleService>(Modules.PRICING)
  const inventoryService = req.scope.resolve<IInventoryModuleService>(Modules.INVENTORY)
  const linkService = req.scope.resolve<ILinkService>(ContainerRegistrationKeys.LINK)

  if (!req.pricingContext) {
    throw new AppError({
      type: ErrorTypes.UNEXPECTED_STATE,
      message: 'pricingContext missing — setPricingContext middleware not applied',
    })
  }

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
  const availableByItemId = new Map(
    await Promise.all(
      itemIds.map(async (itemId) => [itemId, await inventoryService.retrieveAvailableQuantity(itemId)] as const),
    ),
  )
  const inStockByVariantId = buildVariantStock(inventoryLinks, availableByItemId)

  const variantsForResponse = variants.flatMap((variant) => {
    const calculatedPrice = priceByVariantId.get(variant.id)
    if (!calculatedPrice) return []
    // Filtering the rank-ordered images means `imageIds` inherits that order for free.
    const imageIds = images.filter((image) => linkedImages.has(`${variant.id}:${image.id}`)).map((image) => image.id)
    // TODO(inventory): evaluate stock availability logic after inventory feature is complete.
    // A variant with no inventory link is absent from the map and counts as buyable, which is what
    // checkout does today — `prepareConfirmInventoryInput` skips unmapped variants entirely.
    const inStock = inStockByVariantId.get(variant.id) ?? true
    return { ...variant, imageIds, inStock, optionValues: optionValuesByVariantId[variant.id] ?? {}, calculatedPrice }
  })

  // Built from the variants actually being shipped, so the picker never offers one the response
  // dropped for having no price.
  const pickerTargets = await productService.buildProductPickerTargets(req.params.id, variantsForResponse)

  const imageUrlById = new Map(images.map((image) => [image.id, image.url]))
  const optionsForResponse = options.map((option) => ({
    ...option,
    values: option.values.map((value) => {
      const carrier = variantsForResponse.find((variant) => variant.optionValues[option.id] === value.id)
      const swatchImageUrl = carrier?.imageIds[0] ? (imageUrlById.get(carrier.imageIds[0]) ?? null) : null
      return { ...value, swatchImageUrl }
    }),
  }))

  return {
    status: 200,
    json: {
      product: { ...product, images, options: optionsForResponse, variants: variantsForResponse, pickerTargets },
    },
  }
}

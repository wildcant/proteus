import type { IInventoryModuleService } from '@core/types/inventory/service.js'
import type { ILinkService } from '@core/types/link/service.js'
import type { IPricingModuleService } from '@core/types/pricing/service.js'
import type { IProductModuleService } from '@core/types/product/service.js'
import { ContainerRegistrationKeys } from '@core/utils/container.js'
import { Modules } from '@core/utils/modules-definition.js'
import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import {
  AdminProductVariantResponse,
  AdminUpdateProductVariant,
  AdminUpdateProductVariantResponse,
  DeleteResponse,
  VariantIdParams,
} from '@proteus/http-schemas/admin'
import { deleteProductVariantWorkflow } from '@workflows/product/delete-product-variant.js'
import { updateProductVariantWorkflow } from '@workflows/product/update-product-variant.js'
import {
  buildAvailableQuantities,
  variantAvailableQuantityProjection,
} from '@workflows/product/utils/build-variant-stock.js'

export const GetInput = { params: VariantIdParams }
export const GetOutput = AdminProductVariantResponse

export const GET = async (req: HttpRequest<typeof GetInput>): Promise<HttpResult<typeof GetOutput>> => {
  const productService = req.scope.resolve<IProductModuleService>(Modules.PRODUCT)
  const pricingService = req.scope.resolve<IPricingModuleService>(Modules.PRICING)
  const inventoryService = req.scope.resolve<IInventoryModuleService>(Modules.INVENTORY)
  const linkService = req.scope.resolve<ILinkService>(ContainerRegistrationKeys.LINK)

  const [retrieved, images] = await Promise.all([
    productService.retrieveProductVariant(req.params.variantId),
    productService.listImagesForVariant(req.params.variantId),
  ])

  const variant = await productService.enrichVariant(retrieved)

  const [priceLinks, inventoryLinks] = await Promise.all([
    linkService.repo('productVariantPriceSet').findByVariantIds([variant.id]),
    linkService.repo('productVariantInventoryItem').findByVariantIds([variant.id]),
  ])
  const [variantAndPriceSetLink] = priceLinks
  const priceSetId = variantAndPriceSetLink?.priceSetId
  const inventoryItemIds = [...new Set(inventoryLinks.map(({ inventoryItemId }) => inventoryItemId))]
  const levels = inventoryItemIds.length
    ? await inventoryService.listInventoryLevels({ inventoryItemId: inventoryItemIds })
    : []
  const availableQuantity = variantAvailableQuantityProjection(
    inventoryLinks,
    buildAvailableQuantities(levels),
  )(variant)
  const [level] = levels
  const stock =
    variant.manageInventory && level
      ? {
          stockedQuantity: level.stockedQuantity,
          reservedQuantity: level.reservedQuantity,
          availableQuantity: availableQuantity ?? 0,
        }
      : null
  const detailed = { ...variant, images, stock }

  if (!priceSetId) return { status: 200, json: { variant: detailed } }

  const prices = await pricingService.listPrices({ priceSetId })

  return { status: 200, json: { variant: { ...detailed, prices } } }
}

export const PatchInput = { params: VariantIdParams, body: AdminUpdateProductVariant }
export const PatchOutput = AdminUpdateProductVariantResponse
export const PatchThrows = [...updateProductVariantWorkflow.throws] as const

export const PATCH = async (req: HttpRequest<typeof PatchInput>): Promise<HttpResult<typeof PatchOutput>> => {
  const productService = req.scope.resolve<IProductModuleService>(Modules.PRODUCT)
  const updated = await updateProductVariantWorkflow.run({ variantId: req.params.variantId, data: req.body })
  const variant = await productService.enrichVariant(updated)

  return { status: 200, json: { variant } }
}

export const DeleteInput = { params: VariantIdParams }
export const DeleteOutput = DeleteResponse
export const DeleteThrows = [...deleteProductVariantWorkflow.throws] as const

export const DELETE = async (req: HttpRequest<typeof DeleteInput>): Promise<HttpResult<typeof DeleteOutput>> => {
  await deleteProductVariantWorkflow.run({ variantId: req.params.variantId })
  return { status: 200, json: { id: req.params.variantId, deleted: true } }
}

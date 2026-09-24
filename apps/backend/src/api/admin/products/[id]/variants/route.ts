import { AppError, ErrorTypes } from '@core/errors/app-error.js'
import { ContainerRegistrationKeys } from '@core/utils/container.js'
import { Modules } from '@core/utils/modules-definition.js'
import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import {
  AdminCreateProductVariant,
  AdminCreateProductVariantResponse,
  AdminProductVariantListParams,
  AdminProductVariantListResponse,
  IdParams,
} from '@proteus/http-schemas/admin'
import { i18n } from '@proteus/utils'
import { createProductVariantsWorkflow } from '@workflows/product/create-product-variants.js'
import {
  buildAvailableQuantities,
  variantAvailableQuantityProjection,
} from '@workflows/product/utils/build-variant-stock.js'

export const GetInput = { params: IdParams, query: AdminProductVariantListParams }
export const GetOutput = AdminProductVariantListResponse

export const GET = async (req: HttpRequest<typeof GetInput>): Promise<HttpResult<typeof GetOutput>> => {
  const productService = req.scope.resolve(Modules.PRODUCT)
  const inventoryService = req.scope.resolve(Modules.INVENTORY)
  const linkService = req.scope.resolve(ContainerRegistrationKeys.LINK)
  const { pagination, filters } = req.validatedQuery
  const [variants, count] = await productService.listAndCountProductVariants(
    { ...filters, productId: req.params.id },
    pagination,
  )
  const enriched = await productService.enrichVariants(variants)
  const links = await linkService.repo('productVariantInventoryItem').findByVariantIds(variants.map(({ id }) => id))
  const inventoryItemIds = [...new Set(links.map(({ inventoryItemId }) => inventoryItemId))]
  const levels = inventoryItemIds.length
    ? await inventoryService.listInventoryLevels({ inventoryItemId: inventoryItemIds })
    : []
  const availableQuantity = variantAvailableQuantityProjection(links, buildAvailableQuantities(levels))
  const { offset, limit } = pagination
  return {
    status: 200,
    json: {
      variants: enriched.map((variant) => ({ ...variant, availableQuantity: availableQuantity(variant) })),
      count,
      offset,
      limit,
    },
  }
}

export const PostInput = { params: IdParams, body: AdminCreateProductVariant }
export const PostOutput = AdminCreateProductVariantResponse
export const PostThrows = [ErrorTypes.UNEXPECTED_STATE, ...createProductVariantsWorkflow.throws] as const

export const POST = async (req: HttpRequest<typeof PostInput>): Promise<HttpResult<typeof PostOutput>> => {
  const productService = req.scope.resolve(Modules.PRODUCT)
  const created = await createProductVariantsWorkflow.run({
    productId: req.params.id,
    variants: [req.body],
  })

  const [createdVariant] = created
  if (!createdVariant) {
    throw new AppError({ type: ErrorTypes.UNEXPECTED_STATE, message: i18n.t('Variant creation returned no results') })
  }

  const variant = await productService.enrichVariant(createdVariant)

  return { status: 201, json: { variant } }
}

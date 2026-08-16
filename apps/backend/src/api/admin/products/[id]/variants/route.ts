import { AppError, ErrorTypes } from '@core/errors/app-error.js'
import type { IProductModuleService } from '@core/types/index.js'
import { Modules } from '@core/utils/index.js'
import {
  AdminCreateProductVariant,
  AdminCreateProductVariantResponse,
  AdminProductVariantListParams,
  AdminProductVariantListResponse,
  IdParams,
} from '@proteus/http-schemas/admin'
import { createProductVariantsWorkflow } from '@workflows/product/create-product-variants.js'
import type { HttpRequest, HttpResult } from '../../../../../server/ports.js'

export const GetInput = { params: IdParams, query: AdminProductVariantListParams }
export const GetOutput = AdminProductVariantListResponse

export const GET = async (req: HttpRequest<typeof GetInput>): Promise<HttpResult<typeof GetOutput>> => {
  const productService = req.scope.resolve<IProductModuleService>(Modules.PRODUCT)
  const { pagination, filters } = req.validatedQuery
  const [variants, count] = await productService.listAndCountProductVariants(
    { ...filters, productId: req.params.id },
    pagination,
  )
  const { offset, limit } = pagination
  return { status: 200, json: { variants, count, offset, limit } }
}

export const PostInput = { params: IdParams, body: AdminCreateProductVariant }
export const PostOutput = AdminCreateProductVariantResponse

export const POST = async (req: HttpRequest<typeof PostInput>): Promise<HttpResult<typeof PostOutput>> => {
  const [variant] = await createProductVariantsWorkflow.run({
    productId: req.params.id,
    variants: [req.body],
  })

  if (!variant) {
    throw new AppError({ type: ErrorTypes.UNEXPECTED_STATE, message: 'Variant creation returned no results' })
  }

  return { status: 201, json: { variant } }
}

import type { IProductModuleService } from '@core/types/index.js'
import { Modules } from '@core/utils/index.js'
import {
  AdminCreateProductOption,
  AdminProductOptionListParams,
  AdminProductOptionListResponse,
  AdminProductOptionResponse,
} from '@proteus/http-schemas/admin'
import type { HttpRequest, HttpResult } from '../../../server/ports.js'

export const GetInput = { query: AdminProductOptionListParams }
export const GetOutput = AdminProductOptionListResponse

export const GET = async (req: HttpRequest<typeof GetInput>): Promise<HttpResult<typeof GetOutput>> => {
  const productService = req.scope.resolve<IProductModuleService>(Modules.PRODUCT)
  const { pagination, filters } = req.validatedQuery
  const [productOptions, count] = await productService.listAndCountProductOptions(filters, pagination)
  const { offset, limit } = pagination
  return { status: 200, json: { productOptions, count, offset, limit } }
}

export const PostInput = { body: AdminCreateProductOption }
export const PostOutput = AdminProductOptionResponse

export const POST = async (req: HttpRequest<typeof PostInput>): Promise<HttpResult<typeof PostOutput>> => {
  const productService = req.scope.resolve<IProductModuleService>(Modules.PRODUCT)
  const productOption = await productService.createProductOption(req.body)
  return { status: 201, json: { productOption } }
}

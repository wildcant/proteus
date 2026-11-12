import { ErrorTypes } from '@core/errors/app-error.js'
import { Modules } from '@core/utils/modules-definition.js'
import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import {
  AdminCreateProductType,
  AdminProductTypeListParams,
  AdminProductTypeListResponse,
  AdminProductTypeResponse,
} from '@proteus/http-schemas/admin'

export const GetInput = { query: AdminProductTypeListParams }
export const GetOutput = AdminProductTypeListResponse

export const GET = async (req: HttpRequest<typeof GetInput>): Promise<HttpResult<typeof GetOutput>> => {
  const productService = req.scope.resolve(Modules.PRODUCT)
  const { pagination, filters } = req.validatedQuery
  const [types, count] = await productService.listAndCountTypes(filters, pagination)
  const { offset, limit } = pagination
  return { status: 200, json: { types, count, offset, limit } }
}

export const PostInput = { body: AdminCreateProductType }
export const PostOutput = AdminProductTypeResponse
// createType throws DUPLICATE_ERROR from the module when the value is taken
// ast-grep-ignore: route-declares-unthrown-error
export const PostThrows = [ErrorTypes.DUPLICATE_ERROR] as const

export const POST = async (req: HttpRequest<typeof PostInput>): Promise<HttpResult<typeof PostOutput>> => {
  const productService = req.scope.resolve(Modules.PRODUCT)
  const type = await productService.createType(req.body)
  return { status: 201, json: { type } }
}

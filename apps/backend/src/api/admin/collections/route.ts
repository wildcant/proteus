import { ErrorTypes } from '@core/errors/app-error.js'
import { Modules } from '@core/utils/modules-definition.js'
import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import {
  AdminCreateProductCollection,
  AdminProductCollectionListParams,
  AdminProductCollectionListResponse,
  AdminProductCollectionResponse,
} from '@proteus/http-schemas/admin'

export const GetInput = { query: AdminProductCollectionListParams }
export const GetOutput = AdminProductCollectionListResponse

export const GET = async (req: HttpRequest<typeof GetInput>): Promise<HttpResult<typeof GetOutput>> => {
  const productService = req.scope.resolve(Modules.PRODUCT)
  const { pagination, filters } = req.validatedQuery
  const [collections, count] = await productService.listAndCountCollections(filters, pagination)
  const { offset, limit } = pagination
  return { status: 200, json: { collections, count, offset, limit } }
}

export const PostInput = { body: AdminCreateProductCollection }
export const PostOutput = AdminProductCollectionResponse
// createCollection throws DUPLICATE_ERROR from the module when the handle is taken
// ast-grep-ignore: route-declares-unthrown-error
export const PostThrows = [ErrorTypes.DUPLICATE_ERROR] as const

export const POST = async (req: HttpRequest<typeof PostInput>): Promise<HttpResult<typeof PostOutput>> => {
  const productService = req.scope.resolve(Modules.PRODUCT)
  const collection = await productService.createCollection(req.body)
  return { status: 201, json: { collection } }
}

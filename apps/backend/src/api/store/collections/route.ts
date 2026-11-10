import { Modules } from '@core/utils/modules-definition.js'
import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import { StoreProductCollectionListParams, StoreProductCollectionListResponse } from '@proteus/http-schemas/store'

export const GetInput = { query: StoreProductCollectionListParams }
export const GetOutput = StoreProductCollectionListResponse

export const GET = async (req: HttpRequest<typeof GetInput>): Promise<HttpResult<typeof GetOutput>> => {
  const productService = req.scope.resolve(Modules.PRODUCT)
  const { pagination, filters } = req.validatedQuery
  const [collections, count] = await productService.listAndCountCollections(filters, pagination)
  const { offset, limit } = pagination
  return { status: 200, json: { collections, count, offset, limit } }
}

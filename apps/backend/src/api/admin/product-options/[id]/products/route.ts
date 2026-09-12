import type { IProductModuleService } from '@core/types/product/service.js'
import { Modules } from '@core/utils/modules-definition.js'
import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import { AdminProductListParams, AdminProductListResponse, IdParams } from '@proteus/http-schemas/admin'

export const GetInput = { params: IdParams, query: AdminProductListParams }
export const GetOutput = AdminProductListResponse

export const GET = async (req: HttpRequest<typeof GetInput>): Promise<HttpResult<typeof GetOutput>> => {
  const productService = req.scope.resolve<IProductModuleService>(Modules.PRODUCT)
  const { pagination, filters } = req.validatedQuery
  const [products, count] = await productService.listAndCountProductsForOption(req.params.id, filters, pagination)
  const { offset, limit } = pagination
  return { status: 200, json: { products, count, offset, limit } }
}

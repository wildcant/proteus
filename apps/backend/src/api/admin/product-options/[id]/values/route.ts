import type { IProductModuleService } from '@core/types/product/service.js'
import { Modules } from '@core/utils/modules-definition.js'
import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import {
  AdminProductOptionValueListParams,
  AdminProductOptionValueListResponse,
  IdParams,
} from '@proteus/http-schemas/admin'

export const GetInput = { params: IdParams, query: AdminProductOptionValueListParams }
export const GetOutput = AdminProductOptionValueListResponse

export const GET = async (req: HttpRequest<typeof GetInput>): Promise<HttpResult<typeof GetOutput>> => {
  const productService = req.scope.resolve<IProductModuleService>(Modules.PRODUCT)
  const { pagination, filters } = req.validatedQuery
  const [values, count] = await productService.listAndCountProductOptionValues(
    { ...filters, optionId: req.params.id },
    pagination,
  )
  const { offset, limit } = pagination
  return { status: 200, json: { values, count, offset, limit } }
}

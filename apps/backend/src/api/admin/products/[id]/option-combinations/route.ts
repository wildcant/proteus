import type { IProductModuleService } from '@core/types/index.js'
import { Modules } from '@core/utils/index.js'
import {
  AdminOptionCombinationListParams,
  AdminOptionCombinationListResponse,
  IdParams,
} from '@proteus/http-schemas/admin'
import type { HttpRequest, HttpResult } from '../../../../../server/ports.js'

export const GetInput = { params: IdParams, query: AdminOptionCombinationListParams }
export const GetOutput = AdminOptionCombinationListResponse

/**
 * The Option Combinations this product could sell, each naming the variant that has it or `null`
 * while it is still available.
 *
 * Every option-picking surface reads this one list and filters it: create takes the free ones, edit
 * takes those plus its own, the matrix step takes all of them.
 */
export const GET = async (req: HttpRequest<typeof GetInput>): Promise<HttpResult<typeof GetOutput>> => {
  const productService = req.scope.resolve<IProductModuleService>(Modules.PRODUCT)
  const { pagination, filters } = req.validatedQuery
  const { offset, limit } = pagination
  const [combinations, count] = await productService.listProductOptionCombinations(req.params.id, {
    label: filters.label,
    offset,
    limit,
  })
  return { status: 200, json: { combinations, count, offset, limit } }
}

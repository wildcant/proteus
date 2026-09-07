import type { IOrderModuleService } from '@core/types/index.js'
import { Modules } from '@core/utils/index.js'
import { AdminOrderListParams, AdminOrderListResponse } from '@proteus/http-schemas/admin'
import type { HttpRequest, HttpResult } from '@server/ports.js'

export const GetInput = { query: AdminOrderListParams }
export const GetOutput = AdminOrderListResponse

export const GET = async (req: HttpRequest<typeof GetInput>): Promise<HttpResult<typeof GetOutput>> => {
  const orderService = req.scope.resolve<IOrderModuleService>(Modules.ORDER)
  const { pagination, filters } = req.validatedQuery
  const [orders, count] = await orderService.listAndCountOrders(filters, pagination)
  const { offset, limit } = pagination
  return { status: 200, json: { orders, count, offset, limit } }
}

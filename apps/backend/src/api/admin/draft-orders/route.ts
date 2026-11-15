import { Modules } from '@core/utils/modules-definition.js'
import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import { AdminDraftOrderListParams, AdminDraftOrderListResponse } from '@proteus/http-schemas/admin'
import { orderReference } from '@workflows/order/utils/order-reference.js'

export const GetInput = { query: AdminDraftOrderListParams }
export const GetOutput = AdminDraftOrderListResponse

export const GET = async (req: HttpRequest<typeof GetInput>): Promise<HttpResult<typeof GetOutput>> => {
  const orderService = req.scope.resolve(Modules.ORDER)

  const { pagination, filters } = req.validatedQuery
  // By the flag rather than the status, so a draft the shop canceled stays in this list.
  const [orders, count] = await orderService.listAndCountOrders({ ...filters, isDraftOrder: true }, pagination)
  const { offset, limit } = pagination

  const draftOrders = orders.map((order) => ({ ...order, reference: orderReference(order.displayId) }))

  return { status: 200, json: { draftOrders, count, offset, limit } }
}

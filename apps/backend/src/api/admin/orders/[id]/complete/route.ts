import type { IOrderModuleService } from '@core/types/index.js'
import { Modules } from '@core/utils/index.js'
import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import { AdminOrderActionResponse, IdParams } from '@proteus/http-schemas/admin'

export const PostInput = { params: IdParams }
export const PostOutput = AdminOrderActionResponse

export const POST = async (req: HttpRequest<typeof PostInput>): Promise<HttpResult<typeof PostOutput>> => {
  const orderService = req.scope.resolve<IOrderModuleService>(Modules.ORDER)
  const order = await orderService.completeOrder(req.params.id)
  return { status: 200, json: { order } }
}

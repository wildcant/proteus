import { AdminOrderActionResponse, OrderFulfillmentIdParams } from '@proteus/http-schemas/admin'
import type { HttpRequest, HttpResult } from '../../../../../../../server/ports.js'

export const PostInput = { params: OrderFulfillmentIdParams }
export const PostOutput = AdminOrderActionResponse

// Stub — will be wired to markOrderDeliveredWorkflow in ticket 05
export const POST = async (_req: HttpRequest<typeof PostInput>): Promise<HttpResult<typeof PostOutput>> => {
  throw new Error('Not implemented: markOrderDeliveredWorkflow (ticket 05)')
}

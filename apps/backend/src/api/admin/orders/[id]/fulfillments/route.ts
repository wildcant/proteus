import { AdminOrderActionResponse, IdParams } from '@proteus/http-schemas/admin'
import type { HttpRequest, HttpResult } from '../../../../../server/ports.js'

export const PostInput = { params: IdParams }
export const PostOutput = AdminOrderActionResponse

// Stub — will be wired to createOrderFulfillmentWorkflow in ticket 05
export const POST = async (_req: HttpRequest<typeof PostInput>): Promise<HttpResult<typeof PostOutput>> => {
  throw new Error('Not implemented: createOrderFulfillmentWorkflow (ticket 05)')
}

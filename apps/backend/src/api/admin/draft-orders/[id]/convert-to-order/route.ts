import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import { AdminConvertDraftOrder, AdminOrderActionResponse, IdParams } from '@proteus/http-schemas/admin'
import { convertDraftOrderWorkflow } from '@workflows/draft-order/convert-draft-order.js'
import { orderReference } from '@workflows/order/utils/order-reference.js'

export const PostInput = { params: IdParams, body: AdminConvertDraftOrder }
export const PostOutput = AdminOrderActionResponse
export const PostThrows = [...convertDraftOrderWorkflow.throws] as const

/**
 * Converts a draft into a `pending` Order that holds its stock, optionally recording the deposit in
 * the same action. The Order then leaves the drafts list for the orders list.
 */
export const POST = async (req: HttpRequest<typeof PostInput>): Promise<HttpResult<typeof PostOutput>> => {
  const order = await convertDraftOrderWorkflow.run({ orderId: req.params.id, paymentAmount: req.body.paymentAmount })

  return {
    status: 200,
    // Just converted, so nothing has shipped yet.
    json: { order: { ...order, reference: orderReference(order.displayId), fulfillmentStatus: 'unfulfilled' } },
  }
}

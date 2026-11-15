import { ErrorTypes } from '@core/errors/app-error.js'
import { Modules } from '@core/utils/modules-definition.js'
import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import {
  AdminDraftOrderResponse,
  AdminUpdateDraftOrderItem,
  DeleteResponse,
  DraftOrderItemParams,
} from '@proteus/http-schemas/admin'
import { removeDraftOrderItemWorkflow } from '@workflows/draft-order/remove-draft-order-item.js'
import { updateDraftOrderItemWorkflow } from '@workflows/draft-order/update-draft-order-item.js'
import { orderReference } from '@workflows/order/utils/order-reference.js'

export const PostInput = { params: DraftOrderItemParams, body: AdminUpdateDraftOrderItem }
export const PostOutput = AdminDraftOrderResponse
// The order module refuses a line the draft does not hold (NOT_FOUND) and a draft no longer open
// (NOT_ALLOWED), inside both workflows.
const ORDER_MODULE_REFUSALS = [ErrorTypes.NOT_ALLOWED, ErrorTypes.NOT_FOUND] as const
export const PostThrows = [...updateDraftOrderItemWorkflow.throws, ...ORDER_MODULE_REFUSALS] as const

/** Changes a draft line's quantity, and re-prices the draft's shipping. */
export const POST = async (req: HttpRequest<typeof PostInput>): Promise<HttpResult<typeof PostOutput>> => {
  await updateDraftOrderItemWorkflow.run({
    orderId: req.params.id,
    lineItemId: req.params.itemId,
    quantity: req.body.quantity,
  })
  const draftOrder = await req.scope.resolve(Modules.ORDER).retrieveDraftOrder(req.params.id)

  return { status: 200, json: { draftOrder: { ...draftOrder, reference: orderReference(draftOrder.displayId) } } }
}

export const DeleteInput = { params: DraftOrderItemParams }
export const DeleteOutput = DeleteResponse
export const DeleteThrows = [...removeDraftOrderItemWorkflow.throws, ...ORDER_MODULE_REFUSALS] as const

/** Removes a line from a draft, and re-prices the draft's shipping. */
export const DELETE = async (req: HttpRequest<typeof DeleteInput>): Promise<HttpResult<typeof DeleteOutput>> => {
  await removeDraftOrderItemWorkflow.run({ orderId: req.params.id, lineItemId: req.params.itemId })

  return { status: 200, json: { id: req.params.itemId, deleted: true } }
}

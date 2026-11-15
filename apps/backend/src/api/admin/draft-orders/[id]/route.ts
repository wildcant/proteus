import { ErrorTypes } from '@core/errors/app-error.js'
import { Modules } from '@core/utils/modules-definition.js'
import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import { AdminDraftOrderResponse, AdminUpdateDraftOrder, DeleteResponse, IdParams } from '@proteus/http-schemas/admin'
import { deleteDraftOrderWorkflow } from '@workflows/draft-order/delete-draft-order.js'
import { updateDraftOrderWorkflow } from '@workflows/draft-order/update-draft-order.js'
import { orderReference } from '@workflows/order/utils/order-reference.js'

export const GetInput = { params: IdParams }
export const GetOutput = AdminDraftOrderResponse
// retrieveDraftOrder answers NOT_FOUND for an unknown id and for an Order that was never a draft.
// ast-grep-ignore: route-declares-unthrown-error
export const GetThrows = [ErrorTypes.NOT_FOUND] as const

export const GET = async (req: HttpRequest<typeof GetInput>): Promise<HttpResult<typeof GetOutput>> => {
  const draftOrder = await req.scope.resolve(Modules.ORDER).retrieveDraftOrder(req.params.id)

  return { status: 200, json: { draftOrder: { ...draftOrder, reference: orderReference(draftOrder.displayId) } } }
}

export const PostInput = { params: IdParams, body: AdminUpdateDraftOrder }
export const PostOutput = AdminDraftOrderResponse
// The order module refuses an Order that is not an open draft (NOT_ALLOWED) or does not exist
// (NOT_FOUND), inside the workflow.
// ast-grep-ignore: route-declares-unthrown-error
export const PostThrows = [...updateDraftOrderWorkflow.throws, ErrorTypes.NOT_ALLOWED, ErrorTypes.NOT_FOUND] as const

export const POST = async (req: HttpRequest<typeof PostInput>): Promise<HttpResult<typeof PostOutput>> => {
  await updateDraftOrderWorkflow.run({ orderId: req.params.id, ...req.body })
  const draftOrder = await req.scope.resolve(Modules.ORDER).retrieveDraftOrder(req.params.id)

  return { status: 200, json: { draftOrder: { ...draftOrder, reference: orderReference(draftOrder.displayId) } } }
}

export const DeleteInput = { params: IdParams }
export const DeleteOutput = DeleteResponse
// The order module refuses an Order that was never a draft (NOT_ALLOWED) or does not exist
// (NOT_FOUND), inside the workflow.
// ast-grep-ignore: route-declares-unthrown-error
export const DeleteThrows = [...deleteDraftOrderWorkflow.throws, ErrorTypes.NOT_ALLOWED, ErrorTypes.NOT_FOUND] as const

export const DELETE = async (req: HttpRequest<typeof DeleteInput>): Promise<HttpResult<typeof DeleteOutput>> => {
  await deleteDraftOrderWorkflow.run({ orderId: req.params.id })

  return { status: 200, json: { id: req.params.id, deleted: true } }
}

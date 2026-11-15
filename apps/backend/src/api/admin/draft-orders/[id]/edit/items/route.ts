import { Modules } from '@core/utils/modules-definition.js'
import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import { AdminAddDraftOrderItems, AdminDraftOrderResponse, IdParams } from '@proteus/http-schemas/admin'
import { addDraftOrderItemsWorkflow } from '@workflows/draft-order/add-draft-order-items.js'
import { orderReference } from '@workflows/order/utils/order-reference.js'

export const PostInput = { params: IdParams, body: AdminAddDraftOrderItems }
export const PostOutput = AdminDraftOrderResponse
export const PostThrows = [...addDraftOrderItemsWorkflow.throws] as const

/** Adds variants to a draft, priced in its region's currency, and re-prices its shipping. */
export const POST = async (req: HttpRequest<typeof PostInput>): Promise<HttpResult<typeof PostOutput>> => {
  await addDraftOrderItemsWorkflow.run({ orderId: req.params.id, items: req.body.items })
  const draftOrder = await req.scope.resolve(Modules.ORDER).retrieveDraftOrder(req.params.id)

  return { status: 200, json: { draftOrder: { ...draftOrder, reference: orderReference(draftOrder.displayId) } } }
}

import { ErrorTypes } from '@core/errors/app-error.js'
import { Modules } from '@core/utils/modules-definition.js'
import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import { AdminDraftOrderResponse, AdminSetDraftOrderShippingMethod, IdParams } from '@proteus/http-schemas/admin'
import { setDraftOrderShippingMethodWorkflow } from '@workflows/draft-order/set-draft-order-shipping-method.js'
import { orderReference } from '@workflows/order/utils/order-reference.js'

export const PostInput = { params: IdParams, body: AdminSetDraftOrderShippingMethod }
export const PostOutput = AdminDraftOrderResponse
// An unknown shipping option or draft is the fulfillment and order modules' NOT_FOUND, inside the
// workflow.
// ast-grep-ignore: route-declares-unthrown-error
export const PostThrows = [...setDraftOrderShippingMethodWorkflow.throws, ErrorTypes.NOT_FOUND] as const

/** Sets or replaces a draft's shipping method, priced by its option or at the shop's custom amount. */
export const POST = async (req: HttpRequest<typeof PostInput>): Promise<HttpResult<typeof PostOutput>> => {
  await setDraftOrderShippingMethodWorkflow.run({ orderId: req.params.id, ...req.body })
  const draftOrder = await req.scope.resolve(Modules.ORDER).retrieveDraftOrder(req.params.id)

  return { status: 200, json: { draftOrder: { ...draftOrder, reference: orderReference(draftOrder.displayId) } } }
}

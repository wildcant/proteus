import { Modules } from '@core/utils/modules-definition.js'
import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import { AdminPaymentCollectionResponse, AdminRecordOrderPayment, IdParams } from '@proteus/http-schemas/admin'
import { recordOrderPaymentWorkflow } from '@workflows/payment/record-order-payment.js'

export const PostInput = { params: IdParams, body: AdminRecordOrderPayment }
export const PostOutput = AdminPaymentCollectionResponse
export const PostThrows = [...recordOrderPaymentWorkflow.throws] as const

/**
 * Records a payment received outside Proteus on the Order — the deposit, then the rest.
 *
 * On the Order rather than on a payment, because the admin records money against what the shopper
 * owes, not against an authorization they never see: the Order has one payment collection, and
 * the first payment recorded is what opens its authorization. Answers with that collection as it
 * stands afterwards, its payments and captures included.
 */
export const POST = async (req: HttpRequest<typeof PostInput>): Promise<HttpResult<typeof PostOutput>> => {
  const paymentService = req.scope.resolve(Modules.PAYMENT)

  const recorded = await recordOrderPaymentWorkflow.run({ orderId: req.params.id, amount: req.body.amount })
  const paymentCollection = await paymentService.retrievePaymentCollection(recorded.paymentCollectionId)

  return { status: 200, json: { paymentCollection } }
}

import { Modules } from '@core/utils/modules-definition.js'
import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import { AdminPaymentResponse, AdminRefundPayment, IdParams } from '@proteus/http-schemas/admin'
import { refundPaymentWorkflow } from '@workflows/payment/refund-payment.js'

export const PostInput = { params: IdParams, body: AdminRefundPayment }
export const PostOutput = AdminPaymentResponse
export const PostThrows = [...refundPaymentWorkflow.throws] as const

export const POST = async (req: HttpRequest<typeof PostInput>): Promise<HttpResult<typeof PostOutput>> => {
  const paymentService = req.scope.resolve(Modules.PAYMENT)

  await refundPaymentWorkflow.run({
    paymentId: req.params.id,
    amount: req.body.amount,
    refundReasonId: req.body.refundReasonId,
    note: req.body.note,
  })
  const payment = await paymentService.retrievePayment(req.params.id)

  return { status: 200, json: { payment } }
}

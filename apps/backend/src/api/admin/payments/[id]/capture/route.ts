import { Modules } from '@core/utils/modules-definition.js'
import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import { AdminCapturePayment, AdminPaymentResponse, IdParams } from '@proteus/http-schemas/admin'
import { capturePaymentWorkflow } from '@workflows/payment/capture-payment.js'

export const PostInput = { params: IdParams, body: AdminCapturePayment }
export const PostOutput = AdminPaymentResponse
export const PostThrows = [...capturePaymentWorkflow.throws] as const

export const POST = async (req: HttpRequest<typeof PostInput>): Promise<HttpResult<typeof PostOutput>> => {
  const paymentService = req.scope.resolve(Modules.PAYMENT)

  await capturePaymentWorkflow.run({ paymentId: req.params.id, amount: req.body.amount })
  const payment = await paymentService.retrievePayment(req.params.id)

  return { status: 200, json: { payment } }
}

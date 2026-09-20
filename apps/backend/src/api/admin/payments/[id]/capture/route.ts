import { Modules } from '@core/utils/modules-definition.js'
import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import { AdminPaymentResponse, IdParams } from '@proteus/http-schemas/admin'

export const PostInput = { params: IdParams }
export const PostOutput = AdminPaymentResponse

export const POST = async (req: HttpRequest<typeof PostInput>): Promise<HttpResult<typeof PostOutput>> => {
  const paymentService = req.scope.resolve(Modules.PAYMENT)

  const payment = await paymentService.capturePayment({ paymentId: req.params.id })

  return { status: 200, json: { payment } }
}

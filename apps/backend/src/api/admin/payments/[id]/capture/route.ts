import type { IPaymentModuleService } from '@core/types/index.js'
import { Modules } from '@core/utils/index.js'
import { AdminCapturePayment, AdminPaymentResponse, IdParams } from '@proteus/http-schemas/admin'
import type { HttpRequest, HttpResult } from '../../../../../server/ports.js'

// The body carries nothing and is optional, because an empty request reaches the two runtime
// adapters differently — `{}` from Express, absent from Hono. Validated all the same: the schema
// is strict, so a caller still sending `amount` is told no rather than silently charging the
// shopper the whole authorization.
export const PostInput = { params: IdParams, body: AdminCapturePayment.optional() }
export const PostOutput = AdminPaymentResponse

export const POST = async (req: HttpRequest<typeof PostInput>): Promise<HttpResult<typeof PostOutput>> => {
  const paymentService = req.scope.resolve<IPaymentModuleService>(Modules.PAYMENT)

  const payment = await paymentService.capturePayment({ paymentId: req.params.id })

  return { status: 200, json: { payment } }
}

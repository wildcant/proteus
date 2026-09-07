import type { IPaymentModuleService } from '@core/types/index.js'
import { Modules } from '@core/utils/index.js'
import { AdminPaymentResponse, AdminRefundPayment, IdParams } from '@proteus/http-schemas/admin'
import type { HttpRequest, HttpResult } from '@server/ports.js'

export const PostInput = { params: IdParams, body: AdminRefundPayment }
export const PostOutput = AdminPaymentResponse

export const POST = async (req: HttpRequest<typeof PostInput>): Promise<HttpResult<typeof PostOutput>> => {
  const paymentService = req.scope.resolve<IPaymentModuleService>(Modules.PAYMENT)

  const payment = await paymentService.refundPayment({
    paymentId: req.params.id,
    amount: req.body.amount,
    refundReasonId: req.body.refundReasonId,
    note: req.body.note,
  })

  return { status: 200, json: { payment } }
}

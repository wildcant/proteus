import type { IPaymentModuleService } from '@core/types/payment/service.js'
import { Modules } from '@core/utils/modules-definition.js'
import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import { AdminPaymentCollectionResponse, IdParams } from '@proteus/http-schemas/admin'

export const PostInput = { params: IdParams }
export const PostOutput = AdminPaymentCollectionResponse

export const POST = async (req: HttpRequest<typeof PostInput>): Promise<HttpResult<typeof PostOutput>> => {
  const paymentService = req.scope.resolve<IPaymentModuleService>(Modules.PAYMENT)
  const paymentCollection = await paymentService.markPaymentCollectionAsPaid(req.params.id)

  return { status: 200, json: { paymentCollection } }
}

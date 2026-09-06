import type { IPaymentModuleService } from '@core/types/index.js'
import { Modules } from '@core/utils/index.js'
import { AdminPaymentCollectionResponse, IdParams } from '@proteus/http-schemas/admin'
import type { HttpRequest, HttpResult } from '@server/ports.js'

export const PostInput = { params: IdParams }
export const PostOutput = AdminPaymentCollectionResponse

export const POST = async (req: HttpRequest<typeof PostInput>): Promise<HttpResult<typeof PostOutput>> => {
  const paymentService = req.scope.resolve<IPaymentModuleService>(Modules.PAYMENT)
  const collection = await paymentService.retrievePaymentCollection(req.params.id)

  const session = await paymentService.createPaymentSession(collection.id, {
    providerId: 'pp_system_default',
    amount: collection.amount,
    currencyCode: collection.currencyCode,
  })

  const authorization = await paymentService.authorizePaymentSession(session.id)

  if (authorization.outcome === 'authorized') {
    await paymentService.capturePayment({ paymentId: authorization.payment.id })
  }

  const updated = await paymentService.retrievePaymentCollection(collection.id)

  return { status: 200, json: { paymentCollection: updated } }
}

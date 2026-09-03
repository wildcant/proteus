import type { IPaymentModuleService } from '@core/types/index.js'
import { Modules } from '@core/utils/index.js'
import { CreatePaymentSession, IdParams, StoreCreatePaymentSessionResponse } from '@proteus/http-schemas/store'
import type { HttpRequest, HttpResult } from '../../../../../server/ports.js'

export const PostInput = { params: IdParams, body: CreatePaymentSession }
export const PostOutput = StoreCreatePaymentSessionResponse

/**
 * Opens the session for a checkout.
 *
 * `replacePaymentSession`, not `createPaymentSession`: every Place order press comes through
 * here, so a shopper who is declined and reaches for a second card is retrying rather than paying
 * twice. The previous attempt is abandoned and cancelled at the gateway before this one opens.
 * The admin's mark-as-paid route keeps the additive operation — its session is not a retry of
 * anything.
 */
export const POST = async (req: HttpRequest<typeof PostInput>): Promise<HttpResult<typeof PostOutput>> => {
  const paymentService = req.scope.resolve<IPaymentModuleService>(Modules.PAYMENT)
  const collection = await paymentService.retrievePaymentCollection(req.params.id)

  const session = await paymentService.replacePaymentSession(collection.id, {
    providerId: req.body.providerId,
    amount: collection.amount,
    currencyCode: collection.currencyCode,
    data: req.body.data,
    context: req.body.context,
  })

  return { status: 201, json: { paymentSession: session } }
}

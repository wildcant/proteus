import type { IPaymentModuleService } from '@core/types/index.js'
import { Modules } from '@core/utils/index.js'
import { DeleteResponse, IdParams } from '@proteus/http-schemas/store'
import type { HttpRequest, HttpResult } from '@server/ports.js'
import { requireCustomer } from '../../middlewares.js'

export const DeleteInput = { params: IdParams }
export const DeleteMiddlewares = [requireCustomer()] as const
export const DeleteOutput = DeleteResponse

/**
 * Detaches a stored card.
 *
 * The id in the path is whatever was typed, which is why being authenticated is not the check
 * that matters: the gateway is asked whether the method belongs to this customer's account
 * holder, and answers before anything is detached. `@medusajs/payment-stripe` detaches whatever
 * id it is handed.
 *
 * No Account Holder is created here — a shopper with nothing stored has nothing to remove.
 */
export const DELETE = async (
  req: HttpRequest<typeof DeleteInput, typeof DeleteMiddlewares>,
): Promise<HttpResult<typeof DeleteOutput>> => {
  const customer = req.customer
  const paymentService = req.scope.resolve<IPaymentModuleService>(Modules.PAYMENT)

  await paymentService.deleteSavedMethod(customer.id, req.params.id)

  return { status: 200, json: { id: req.params.id, deleted: true } }
}

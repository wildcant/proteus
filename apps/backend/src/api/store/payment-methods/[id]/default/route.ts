import type { IPaymentModuleService } from '@core/types/index.js'
import { Modules } from '@core/utils/index.js'
import { IdParams, StoreSavedMethodListResponse } from '@proteus/http-schemas/store'
import type { HttpRequest, HttpResult } from '@server/ports.js'
import { requireCustomer } from '../../../middlewares.js'

export const PostInput = { params: IdParams }
export const PostMiddlewares = [requireCustomer()] as const
export const PostOutput = StoreSavedMethodListResponse

/**
 * Nominates the card the shopper's next checkout should start on.
 *
 * The default is the gateway's own field, so this writes nothing in Proteus and needs no
 * migration. Ownership is verified at the gateway first, for the same reason the delete verb
 * does it: an authenticated caller can still name a stranger's method id.
 *
 * Answers with the wallet rather than an acknowledgement, because nominating a default reorders
 * it — and a client that had to refetch to learn its own new order would render the old one for
 * a round trip.
 */
export const POST = async (
  req: HttpRequest<typeof PostInput, typeof PostMiddlewares>,
): Promise<HttpResult<typeof PostOutput>> => {
  const customer = req.customer
  const paymentService = req.scope.resolve<IPaymentModuleService>(Modules.PAYMENT)

  await paymentService.setDefaultSavedMethod(customer.id, req.params.id)
  const paymentMethods = await paymentService.listSavedMethods(customer.id)

  return { status: 200, json: { paymentMethods } }
}

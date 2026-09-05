import type { IPaymentModuleService } from '@core/types/index.js'
import { Modules } from '@core/utils/index.js'
import { StoreSavedMethodListResponse } from '@proteus/http-schemas/store'
import type { HttpRequest, HttpResult } from '../../../server/ports.js'
import { ensureAccountHolders, requestingCustomer } from './wallet.js'

export const GetOutput = StoreSavedMethodListResponse

/**
 * The requesting customer's wallet.
 *
 * Three things this route does *not* do, each on purpose:
 *
 * - It does not take a customer id. The only wallet reachable here is the caller's own, so there
 *   is no id to tamper with — and every method it returns has been listed by the gateway against
 *   the caller's own account holder.
 * - It does not return a gateway object. The projection happens in the adapter, so nothing above
 *   it is ever holding one.
 * - It does not sort. Ordering is the module's, defined once, so the checkout selector and the
 *   account page cannot present two different ideas of "your cards".
 *
 * A shopper without an account gets an empty wallet and no Account Holder is created for them.
 */
export const GET = async (req: HttpRequest): Promise<HttpResult<typeof GetOutput>> => {
  const customer = await requestingCustomer(req)
  const paymentService = req.scope.resolve<IPaymentModuleService>(Modules.PAYMENT)

  await ensureAccountHolders(req, customer)
  const paymentMethods = await paymentService.listSavedMethods(customer.id)

  return { status: 200, json: { paymentMethods } }
}

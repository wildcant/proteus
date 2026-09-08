import type { ICartModuleService, ILinkService, IPaymentModuleService } from '@core/types/index.js'
import { ContainerRegistrationKeys, Modules } from '@core/utils/index.js'
import { IdParams, StorePaymentProviderListResponse } from '@proteus/http-schemas/store'
import { env } from '../../../../../env.js'
import type { HttpRequest, HttpResult } from '../../../../../server/ports.js'

export const GetInput = { params: IdParams }
export const GetOutput = StorePaymentProviderListResponse

/**
 * The payment methods this cart's market offers.
 *
 * Scoped to the cart rather than to a region the caller names: the cart is where the region is
 * authoritative — checkout already priced the basket from it — so a region on the request would be
 * a second source of truth free to disagree with the money on screen. Retrieving the cart is also
 * what makes an unknown one a 404 instead of a list of every provider in the deployment.
 */
export const GET = async (req: HttpRequest<typeof GetInput>): Promise<HttpResult<typeof GetOutput>> => {
  const cartService = req.scope.resolve<ICartModuleService>(Modules.CART)
  const paymentService = req.scope.resolve<IPaymentModuleService>(Modules.PAYMENT)
  const linkService = req.scope.resolve<ILinkService>(ContainerRegistrationKeys.LINK)

  const cart = await cartService.retrieveCart(req.params.id)

  // A cart with no region is in no market, and a market is the only thing that says which methods
  // apply — so the answer is none, not all of them. Falling back to the full list is exactly the
  // leak this route closes: the shopper would be offered a method that fails at authorization.
  const links = cart.regionId ? await linkService.repo('regionPaymentProvider').findByRegionIds([cart.regionId]) : []
  if (links.length === 0) return { status: 200, json: { paymentProviders: [] } }

  const providers = await paymentService.listPaymentProviders({
    id: links.map((link) => link.paymentProviderId),
    isEnabled: true,
  })

  const paymentProviders = providers
    .map((provider) => ({
      ...provider,
      ...paymentService.getProviderMeta(provider.id),
    }))
    .filter((provider) => !(env.NODE_ENV === 'production' && provider.isTestOnly))

  return { status: 200, json: { paymentProviders } }
}

import { AppError, ErrorTypes } from '@core/errors/app-error.js'
import type {
  CustomerDTO,
  ICartModuleService,
  ICustomerModuleService,
  IRegionModuleService,
  IStoreModuleService,
  RegionDTO,
} from '@core/types/index.js'
import { Modules } from '@core/utils/index.js'
import { validateQuery } from '@core/utils/validate-query.js'
import type { MiddlewareFunction } from '@framework/http/types.js'
import { StorePricingContextParams } from '@proteus/http-schemas/store'
import type { AwilixContainer } from 'awilix'

/**
 * Which region a request is being made from, in the order the signals are trusted.
 *
 * A country code is an instruction: the caller said which market it wants, so a country no region
 * sells to is an error rather than a reason to reach for the next signal. A cart is only a hint —
 * its id comes off a cookie that outlives the cart it names — so an unknown one, or one opened
 * before the store had regions, falls through. The store's default is the last word, and a store
 * without one has no answer to give: quoting some other currency would price a shopper's basket in
 * money nobody chose.
 */
async function resolveRegion(scope: AwilixContainer, countryCode?: string, cartId?: string): Promise<RegionDTO> {
  const regionService = scope.resolve<IRegionModuleService>(Modules.REGION)

  if (countryCode) {
    // One read for both failures: an unknown ISO code and a country outside every region are the
    // same answer to a storefront, which only offers the countries `GET /store/countries` lists.
    const [country] = await regionService.listCountries({ id: countryCode })
    if (!country?.regionId) {
      throw new AppError({
        type: ErrorTypes.INVALID_DATA,
        message: `No region sells to country "${countryCode}"`,
      })
    }
    return regionService.retrieveRegion(country.regionId)
  }

  if (cartId) {
    const cartService = scope.resolve<ICartModuleService>(Modules.CART)
    const [cart] = await cartService.listCarts({ id: cartId })
    if (cart?.regionId) return regionService.retrieveRegion(cart.regionId)
  }

  const storeService = scope.resolve<IStoreModuleService>(Modules.STORE)
  const store = await storeService.resolveStore()
  if (!store?.defaultRegionId) {
    // The request was well formed; the deployment has no market to fall back on. A 500 rather than
    // a 400, because nothing the caller could send would fix it.
    throw new AppError({
      type: ErrorTypes.UNEXPECTED_STATE,
      message: 'Cannot price this request: no countryCode was given and the store has no default region',
    })
  }

  return regionService.retrieveRegion(store.defaultRegionId)
}

/**
 * Resolves the market — and so the currency — every priced response on this request is quoted in.
 *
 * The currency is derived server-side from a country, deliberately: the storefront already knows
 * which country it is showing — it is the segment in its own URL — and nothing else it holds
 * translates that into money. Sending a currency instead would let a caller name one the region
 * does not settle in.
 *
 * Declared rather than assumed: a route that reads `req.pricingContext` without this middleware in
 * its list no longer compiles, which is what retired the hand-written "pricingContext missing"
 * guards this used to rely on.
 */
export function setPricingContext(): MiddlewareFunction<{
  pricingContext: { currencyCode: string; regionId: string }
}> {
  return async (req) => {
    // Middlewares run before `input` validation, so this parses the raw query itself. The same
    // schema is declared as the route's `contextQuery`, which is what documents it for clients.
    const { countryCode, cartId } = validateQuery(StorePricingContextParams, req.query)

    const region = await resolveRegion(req.scope, countryCode?.toLowerCase(), cartId)

    // TODO(pricing): resolve customer groups for context-based pricing
    return { ...req, pricingContext: { currencyCode: region.currencyCode, regionId: region.id } }
  }
}

/**
 * Loads the Customer row behind the caller's token, or refuses the request.
 *
 * The guard is on the token, not on the row: `retrieveCustomer` is `findByIdOrFail`, so a token
 * naming a customer that no longer exists 404s on its own and never reaches here as `undefined`.
 *
 * On an `auth: 'required'` route the 401 is unreachable — the auth policy has already rejected an
 * anonymous caller. It is here because it is the runtime witness for the non-optional
 * `{ customer: CustomerDTO }` this declares: without a narrow the type would be an assertion, and
 * it stays true if the route's policy is ever relaxed to `'optional'`.
 *
 * Note the distinction this does *not* draw: `hasAccount`. Proteus writes a Customer row for every
 * guest checkout, so a row is not an account. A route that must not touch a gateway on a guest's
 * behalf checks `customer.hasAccount` itself.
 */
export function requireCustomer(): MiddlewareFunction<{ customer: CustomerDTO }> {
  return async (req) => {
    const customerId = req.authContext?.actorId
    if (!customerId) {
      throw new AppError({ type: ErrorTypes.UNAUTHORIZED, message: 'Not authenticated' })
    }

    const customerService = req.scope.resolve<ICustomerModuleService>(Modules.CUSTOMER)
    return { ...req, customer: await customerService.retrieveCustomer(customerId) }
  }
}

/**
 * Loads the Customer row when the caller has a token, and lets a guest through.
 *
 * For `auth: 'optional'` routes, where a guest is a legitimate caller — a shopper pressing Place
 * order without an account still needs a payment session. The handler narrows, and that narrow is
 * where the route says what a guest gets.
 */
export function attachCustomer(): MiddlewareFunction<{ customer?: CustomerDTO }> {
  return async (req) => {
    const customerId = req.authContext?.actorId
    if (!customerId) return req

    const customerService = req.scope.resolve<ICustomerModuleService>(Modules.CUSTOMER)
    return { ...req, customer: await customerService.retrieveCustomer(customerId) }
  }
}

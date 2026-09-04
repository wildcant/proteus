import { z } from 'zod'

/**
 * How a request says which market it is being made from.
 *
 * Every store route that prices something accepts these two, and the server turns them into a
 * currency. Neither names a region or a currency: a storefront passes on the country segment its
 * URL already carries and the cart id it already holds, and never has to learn what a region is.
 *
 * They are read by `setPricingContext` off the raw request, before validation splits a query into
 * pagination and filters — so a route declares them as `contextQuery` rather than folding them
 * into `input.query`, where they would be offered to a repository as column filters.
 */
export const StorePricingContextParams = z.object({
  countryCode: z
    .string()
    .length(2)
    .optional()
    .describe(
      'ISO 3166-1 alpha-2, case-insensitive. The market the request is made from; its owning ' +
        'region decides the currency. Naming a country no region sells to is an error, not a ' +
        'fallback — a shopper would otherwise be quoted a currency nobody chose.',
    ),
  cartId: z
    .string()
    .min(1)
    .optional()
    .describe(
      'The cart the request is made in the context of. Consulted only when no countryCode is ' +
        "given: the cart's region decides the currency, so prices stay in the market the cart " +
        'was opened in. A cart that is unknown or has no region falls through to the default.',
    ),
})

export type StorePricingContextQuery = z.infer<typeof StorePricingContextParams>

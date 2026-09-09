import { queryOptions, useQuery } from '@tanstack/react-query'
import { listStoreCountries } from '#/api/generated/countries/countries'
import type { ListStoreCountriesScope, StoreCountry } from '#/api/generated/model'
import { queryKeysFactory } from '#/lib/query-key-factory'

/**
 * The country table, read from the store rather than carried in the bundle.
 *
 * A shared layer rather than a feature: the address forms, the checkout and an order's delivery
 * panel all need the same list, and `features/orders` may import no other feature — so the list
 * was never any one feature's to own. See ADR 0020 for the graph that rule comes from.
 *
 * Two listings, because they answer two different questions. `sellable` is where the store ships
 * to; `all` is the whole ISO 3166-1 table, which is what a billing address needs (a card can be
 * registered anywhere) and what names the country on an order placed before the store stopped
 * selling there.
 */

export const countriesQueryKeys = queryKeysFactory('store-countries')

/**
 * Static reference data: the ISO table does not change, and a merchant opting a country into a
 * region is not something a mounted form has to notice. Never stale, so the two address forms and
 * the order panel share one request per session rather than one each.
 */
export const countriesQueryOptions = (scope: ListStoreCountriesScope) =>
  queryOptions({
    queryKey: countriesQueryKeys.list({ scope }),
    queryFn: () => listStoreCountries({ scope }),
    staleTime: Number.POSITIVE_INFINITY,
  })

/** The listing, and `[]` until it arrives — a select with no options rather than a wrong one. */
export function useCountries(scope: ListStoreCountriesScope): { countries: Array<StoreCountry> } {
  const { data } = useQuery(countriesQueryOptions(scope))
  return { countries: data?.countries ?? [] }
}

/**
 * Resolves a country code to the name a shopper reads, through the full ISO listing.
 *
 * The full listing and not the sellable one: an order delivered to a country the store has since
 * stopped selling to still has to name it, and that country is in the ISO table but in no region.
 *
 * `undefined` while the listing is in flight, so a caller renders nothing rather than flashing the
 * raw code and replacing it a moment later. Once it has arrived, a code no country claims falls
 * back to itself uppercased — that is data nobody wrote through this storefront, and a blank line
 * where a country belongs is worse than an unfriendly one.
 */
export function useCountryName(): (code: string | null | undefined) => string | undefined {
  const { countries } = useCountries('all')

  return (code) => {
    if (!code) return undefined
    if (countries.length === 0) return undefined
    return countries.find((country) => country.iso2 === code.toLowerCase())?.displayName ?? code.toUpperCase()
  }
}

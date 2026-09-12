import { toast } from '@proteus/ui'
import type { UseMutationOptions } from '@tanstack/react-query'
import { keepPreviousData, queryOptions, useMutation, useQuery } from '@tanstack/react-query'
import { listCountries } from '#/api/generated/countries/countries'
import type {
  AdminAssignRegionCountries,
  AdminCountryResponse,
  AdminRegionCountriesResponse,
  AdminUpdateCountryLocale,
  DeleteResponse,
  ListCountriesParams,
} from '#/api/generated/model'
import { assignRegionCountries, removeRegionCountry, updateRegionCountryLocale } from '#/api/generated/regions/regions'
import { regionKeys } from '#/features/regions/api/regions'
import { queryClient } from '#/lib/query-client'
import { queryKeysFactory } from '#/lib/query-key-factory'

const countryKeys = queryKeysFactory<'countries', ListCountriesParams>('countries')

/**
 * The ISO country list. Every screen here reads it: the region's Countries table asks for one
 * `regionId`, the Add-countries picker asks for all of them and offers the unclaimed ones.
 */
const countriesListQueryOptions = (params?: ListCountriesParams) =>
  queryOptions({
    queryKey: countryKeys.list(params),
    queryFn: () => listCountries(params),
    placeholderData: keepPreviousData,
  })

export const useCountries = (params?: ListCountriesParams) => useQuery(countriesListQueryOptions(params))

/**
 * The whole ISO table in one request, which is what a searchable picker over it needs: paging it
 * would mean typing a country's name and being told there are no results because the match is on
 * page three. `AdminCountryListParams` widens its own ceiling for exactly this caller.
 */
const PICKER_LIMIT = 300

export const selectableCountriesQueryOptions = () => countriesListQueryOptions({ limit: PICKER_LIMIT })

export const useSelectableCountries = () => useQuery(selectableCountriesQueryOptions())

/**
 * Every country in one region, unpaged — the same one-request read, narrowed.
 *
 * There is no retrieve route for a single country: a region covers at most the ISO list, so the
 * screen that needs one country reads them all and picks it out rather than earning a route for it.
 */
export const regionCountriesQueryOptions = (regionId: string) =>
  countriesListQueryOptions({ regionId, limit: PICKER_LIMIT })

export const useRegionCountry = (regionId: string, code: string) => {
  const { data, isPending } = useQuery(regionCountriesQueryOptions(regionId))
  return { country: data?.countries.find((country) => country.id === code), isPending }
}

/**
 * Assigning countries changes the region too — its own detail card lists them — so both caches are
 * invalidated. The same is true of every mutation below.
 */
const invalidateRegionCountries = (regionId: string) => {
  queryClient.invalidateQueries({ queryKey: countryKeys.lists() })
  queryClient.invalidateQueries({ queryKey: regionKeys.detail(regionId) })
  queryClient.invalidateQueries({ queryKey: regionKeys.lists() })
}

export const useAssignRegionCountries = (
  regionId: string,
  options?: UseMutationOptions<AdminRegionCountriesResponse, Error, AdminAssignRegionCountries>,
) => {
  const { onSuccess, onError, ...rest } = options ?? {}
  return useMutation({
    ...rest,
    mutationFn: (data: AdminAssignRegionCountries) => assignRegionCountries(regionId, data),
    onSuccess: (...args) => {
      invalidateRegionCountries(regionId)
      onSuccess?.(...args)
    },
    onError: (...args) => {
      const [error] = args
      toast.add({ type: 'error', title: 'Failed to add countries', description: error.message })
      onError?.(...args)
    },
  })
}

export const useUpdateCountryLocale = (
  regionId: string,
  code: string,
  options?: UseMutationOptions<AdminCountryResponse, Error, AdminUpdateCountryLocale>,
) => {
  const { onSuccess, onError, ...rest } = options ?? {}
  return useMutation({
    ...rest,
    mutationFn: (data: AdminUpdateCountryLocale) => updateRegionCountryLocale(regionId, code, data),
    onSuccess: (...args) => {
      invalidateRegionCountries(regionId)
      onSuccess?.(...args)
    },
    onError: (...args) => {
      const [error] = args
      toast.add({ type: 'error', title: 'Failed to update locale', description: error.message })
      onError?.(...args)
    },
  })
}

/**
 * Removing countries, one code or several.
 *
 * The bulk case is the checkbox column's, and it is several requests rather than one because the
 * API removes a country from a region by naming it — `Promise.all` here rather than a batch route
 * that exists for one screen. A failure in any of them surfaces as the toast below; the ones that
 * succeeded stay removed, and the table reloads showing exactly which.
 */
export const useRemoveRegionCountries = (
  regionId: string,
  options?: UseMutationOptions<DeleteResponse[], Error, string[]>,
) => {
  const { onSuccess, onError, ...rest } = options ?? {}
  return useMutation({
    ...rest,
    mutationFn: (codes: string[]) => Promise.all(codes.map((code) => removeRegionCountry(regionId, code))),
    onSuccess: (...args) => {
      invalidateRegionCountries(regionId)
      onSuccess?.(...args)
    },
    onError: (...args) => {
      const [error] = args
      toast.add({ type: 'error', title: 'Failed to remove countries', description: error.message })
      onError?.(...args)
    },
  })
}

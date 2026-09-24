import { useLingui } from '@lingui/react/macro'
import type { AdminRegion } from '#/api/generated/model'
import { useDefineTable } from '#/components/data-table/hooks/use-define-table'
import { useRegions } from '#/features/regions/api/regions'
import { RegionRowActions } from '#/features/regions/components/region-row-actions'
import { summariseCountries } from '#/features/regions/utils/country-summary'
import { paymentProviderLabel } from '#/features/regions/utils/payment-provider-label'

export const useRegionTable = () => {
  const { t, i18n } = useLingui()

  return useDefineTable<AdminRegion>({
    useData: (params) => {
      const { data, isPending, isFetching } = useRegions(params)
      return {
        data: data?.regions ?? [],
        count: data?.count,
        isPending,
        isFetching,
      }
    },

    columns: (col) => [
      col.accessor('name', { header: t`Name`, sortable: true }),
      col.display('countries', {
        header: t`Countries`,
        cell: ({ row }) =>
          summariseCountries(
            row.countries.map((country) => country.displayName),
            i18n,
          ),
      }),
      col.display('paymentProviders', {
        header: t`Payment Providers`,
        cell: ({ row }) =>
          row.paymentProviders.length === 0
            ? '—'
            : row.paymentProviders.map((provider) => paymentProviderLabel(provider.id)).join(', '),
      }),
    ],

    getRowId: (row) => row.id,
    rowHref: (row) => `/settings/regions/${row.id}`,
    rowActions: (row) => <RegionRowActions region={row} />,

    empty: {
      heading: t`No regions`,
      description: t`Create a region to start selling in a market.`,
    },
    filtered: {
      heading: t`No regions found`,
      description: t`Try changing your search term.`,
    },
  })
}

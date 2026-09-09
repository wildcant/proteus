import type { AdminCountry } from '#/api/generated/model'
import { useDefineTable } from '#/components/data-table'
import { useCountries } from '#/features/regions/api/countries'
import { RegionCountryRowActions } from '#/features/regions/components/region-country-row-actions'

/**
 * The countries a region sells to.
 *
 * `Locale` has no counterpart in the reference admin and is the reason this table exists rather
 * than a list of names: it is the field that decides whether the market works at all — the
 * storefront's URL segment, its `lang` attribute, and the tag its prices and dates are formatted
 * with. A merchant has to be able to see it to know it is wrong.
 */
export const useRegionCountryTable = (
  regionId: string,
  selectedCodes: string[],
  onSelectedCodesChange: (codes: string[]) => void,
) =>
  useDefineTable<AdminCountry>({
    useData: (params) => {
      const { data, isPending, isFetching } = useCountries({ ...params, regionId })
      return {
        data: data?.countries ?? [],
        count: data?.count,
        isPending,
        isFetching,
      }
    },

    columns: (col) => [
      col.accessor('displayName', { header: 'Name', sortable: true }),
      col.accessor('id', { header: 'Code', cell: ({ value }) => value.toUpperCase() }),
      // The em dash is the state this column exists to make visible: a country sellable with no
      // locale is a storefront with no URL segment. The API refuses to create one — this is what
      // would show it if anything else ever did.
      col.accessor('localeCode', { header: 'Locale', cell: ({ value }) => value ?? '—' }),
    ],

    // Must differ from the region list's, which stays mounted on the regions page.
    prefix: 'rc',
    pageSize: 10,
    getRowId: (row) => row.id,
    rowSelection: () => ({
      value: Object.fromEntries(selectedCodes.map((code) => [code, true])),
      onChange: (next) => onSelectedCodesChange(Object.keys(next).filter((code) => next[code])),
    }),
    rowActions: (row) => <RegionCountryRowActions regionId={regionId} country={row} />,

    empty: {
      heading: 'No countries',
      description: 'Add a country to start selling in this region.',
    },
    filtered: {
      heading: 'No countries found',
      description: 'Try changing your search term.',
    },
  })

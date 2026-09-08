import { getCurrencyName } from '@proteus/utils'
import type { AdminStoreCurrency } from '#/api/generated/model'
import { StatusCell, useDefineTable } from '#/components/data-table'
import { useStore } from '#/features/store/api/store'
import { StoreCurrencyRowActions } from '#/features/store/components/store-currency-row-actions'

/**
 * The currencies the store sells in.
 *
 * Searched and paged here rather than by the API, which is the one thing this table does
 * differently from every other. The currencies travel with the store — one payload, a handful of
 * rows, and there is no route that lists them on their own — so a `q` sent to the server would
 * only come back as the same list. The order is the API's: the default leads, then alphabetically,
 * which is the order the variant price editor draws its columns in.
 *
 * `Name` is derived rather than stored. `Intl` already ships every ISO 4217 name, so a column of
 * them in the database would only be a copy going stale.
 */
export const useStoreCurrencyTable = (selectedCodes: string[], onSelectedCodesChange: (codes: string[]) => void) =>
  useDefineTable<AdminStoreCurrency>({
    useData: ({ offset, limit, q }) => {
      const { data, isPending, isFetching } = useStore()

      const currencies = data?.store.currencies ?? []
      const term = q?.trim().toLowerCase()
      const matching = term
        ? currencies.filter(
            (currency) =>
              currency.currencyCode.includes(term) ||
              getCurrencyName(currency.currencyCode).toLowerCase().includes(term),
          )
        : currencies

      return {
        data: matching.slice(offset, offset + limit),
        count: matching.length,
        isPending,
        isFetching,
      }
    },

    columns: (col) => [
      col.accessor('currencyCode', { header: 'Code', cell: ({ value }) => value.toUpperCase() }),
      col.display('name', { header: 'Name', cell: ({ row }) => getCurrencyName(row.currencyCode) }),
      col.accessor('isDefault', {
        header: 'Default',
        cell: ({ value }) => <StatusCell color={value ? 'green' : 'grey'}>{value ? 'Default' : '—'}</StatusCell>,
      }),
    ],

    // Must differ from any other table's; this page holds one, but the prefix keys URL state.
    prefix: 'sc',
    pageSize: 10,
    getRowId: (row) => row.currencyCode,
    rowSelection: () => ({
      value: Object.fromEntries(selectedCodes.map((code) => [code, true])),
      onChange: (next) => onSelectedCodesChange(Object.keys(next).filter((code) => next[code])),
    }),
    rowActions: (row) => <StoreCurrencyRowActions currency={row} />,

    empty: {
      heading: 'No currencies',
      description: 'Add a currency to start pricing products in it.',
    },
    filtered: {
      heading: 'No currencies found',
      description: 'Try changing your search term.',
    },
  })

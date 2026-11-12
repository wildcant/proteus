import { useLingui } from '@lingui/react/macro'
import { DataTable } from '#/components/data-table/data-table'
import { useProductListTable } from '#/features/products/hooks/use-product-list-table'

type ProductPickerProps = {
  value: string[]
  onValueChange: (productIds: string[]) => void
}

/**
 * Every product, searchable, with a checkbox per row, for hand-picking the members of a group.
 * Selection is held by the caller as the whole set of ids, so it survives paging and search. Nothing
 * is ever disabled: a current member is simply pre-checked, and unchecking it is how it is removed.
 */
export function ProductPicker({ value, onValueChange }: ProductPickerProps) {
  const { t } = useLingui()
  const products = useProductListTable(
    {},
    {
      // The picker opens over a group's page, whose own product list holds the `products` prefix.
      prefix: 'picker',
      rowSelection: () => ({
        value: Object.fromEntries(value.map((id) => [id, true])),
        onChange: (next) => onValueChange(Object.keys(next).filter((id) => next[id])),
      }),
      empty: { heading: t`No products yet`, description: t`Create a product to add it here.` },
    },
  )

  return <DataTable use={products} heading={t`Products`} />
}

import { useLingui } from '@lingui/react/macro'
import { DataTable } from '#/components/data-table/data-table'
import { useProductPickerTable } from '#/features/products/hooks/use-product-picker-table'

type ProductPickerProps = {
  value: string[]
  onValueChange: (productIds: string[]) => void
}

/** A searchable product list with a checkbox per row, for hand-picking the members of a group. */
export function ProductPicker({ value, onValueChange }: ProductPickerProps) {
  const { t } = useLingui()
  const products = useProductPickerTable(value, onValueChange)

  return <DataTable use={products} heading={t`Products`} />
}

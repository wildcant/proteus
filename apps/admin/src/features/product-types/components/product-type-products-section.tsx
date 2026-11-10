import { useLingui } from '@lingui/react/macro'
import { DataTable } from '#/components/data-table/data-table'
import { useProductTypeProductsTable } from '#/features/product-types/hooks/use-product-type-products-table'

export function ProductTypeProductsSection({ typeId }: { typeId: string }) {
  const { t } = useLingui()
  const products = useProductTypeProductsTable(typeId)

  return <DataTable use={products} heading={t`Products`} />
}

import { useLingui } from '@lingui/react/macro'
import { DataTable } from '#/components/data-table/data-table'
import { useProductTagProductsTable } from '#/features/product-tags/hooks/use-product-tag-products-table'

export function ProductTagProductsSection({ tagId }: { tagId: string }) {
  const { t } = useLingui()
  const products = useProductTagProductsTable(tagId)

  return <DataTable use={products} heading={t`Products`} />
}

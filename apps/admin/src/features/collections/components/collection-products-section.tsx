import { useLingui } from '@lingui/react/macro'
import { DataTable } from '#/components/data-table/data-table'
import { useCollectionProductsTable } from '#/features/collections/hooks/use-collection-products-table'

export function CollectionProductsSection({ collectionId }: { collectionId: string }) {
  const { t } = useLingui()
  const products = useCollectionProductsTable(collectionId)

  return (
    <DataTable
      use={products}
      heading={t`Products`}
      actions={[{ label: t`Edit products`, to: `/collections/${collectionId}/products` }]}
    />
  )
}

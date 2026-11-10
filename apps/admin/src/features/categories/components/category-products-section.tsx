import { useLingui } from '@lingui/react/macro'
import { DataTable } from '#/components/data-table/data-table'
import { useCategoryProductsTable } from '#/features/categories/hooks/use-category-products-table'

export function CategoryProductsSection({ categoryId }: { categoryId: string }) {
  const { t } = useLingui()
  const products = useCategoryProductsTable(categoryId)

  return (
    <DataTable
      use={products}
      heading={t`Products`}
      actions={[{ label: t`Edit products`, to: `/categories/${categoryId}/products` }]}
    />
  )
}

import { createFileRoute } from '@tanstack/react-router'
import { PageLayout } from '#/components/layout/page-layout'
import { categoryTreeQueryOptions, useSuspenseCategoryTree } from '#/features/categories/api/categories'
import { CategoryTreeList } from '#/features/categories/components/category-tree-list'

export const Route = createFileRoute('/_authed/_shell/categories/')({
  loader: ({ context }) => context.queryClient.ensureQueryData(categoryTreeQueryOptions()),
  component: CategoriesPage,
})

function CategoriesPage() {
  const { data } = useSuspenseCategoryTree()

  return (
    <PageLayout.SingleColumn>
      <CategoryTreeList categories={data.productCategories} />
    </PageLayout.SingleColumn>
  )
}

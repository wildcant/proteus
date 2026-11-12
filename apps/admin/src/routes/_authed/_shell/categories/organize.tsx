import { msg } from '@lingui/core/macro'
import { createFileRoute } from '@tanstack/react-router'
import { PageLayout } from '#/components/layout/page-layout'
import { categoryTreeQueryOptions, useSuspenseCategoryTree } from '#/features/categories/api/categories'
import { CategoryOrganizeTree } from '#/features/categories/components/category-organize-tree'

export const Route = createFileRoute('/_authed/_shell/categories/organize')({
  staticData: { breadcrumb: msg`Organize` },
  loader: ({ context }) => context.queryClient.ensureQueryData(categoryTreeQueryOptions()),
  component: OrganizeCategoriesPage,
})

function OrganizeCategoriesPage() {
  const { data } = useSuspenseCategoryTree()

  return (
    <PageLayout.SingleColumn>
      <CategoryOrganizeTree categories={data.productCategories} />
    </PageLayout.SingleColumn>
  )
}

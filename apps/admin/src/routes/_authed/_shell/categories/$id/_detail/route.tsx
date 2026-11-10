import { useLingui } from '@lingui/react/macro'
import { Card, CardAction, CardHeader, CardTitle, usePrompt } from '@proteus/ui'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { PencilIcon, TrashIcon } from 'lucide-react'
import { ActionMenu } from '#/components/common/action-menu'
import { SectionRow } from '#/components/common/section-row'
import { SingleColumnPageSkeleton } from '#/components/common/skeleton'
import { PageLayout } from '#/components/layout/page-layout'
import {
  categoryTreeQueryOptions,
  useDeleteCategory,
  useSuspenseCategory,
  useSuspenseCategoryTree,
} from '#/features/categories/api/categories'
import { flattenCategoryTree } from '#/features/categories/utils/flatten-category-tree'
import { useUiCopy } from '#/hooks/use-ui-copy'

export const Route = createFileRoute('/_authed/_shell/categories/$id/_detail')({
  // The tree names the parent; the Category itself carries only its id.
  loader: ({ context }) => context.queryClient.ensureQueryData(categoryTreeQueryOptions()),
  pendingComponent: () => <SingleColumnPageSkeleton sections={1} />,
  component: CategoryDetailLayout,
})

function CategoryDetailLayout() {
  const { t } = useLingui()
  const { cancel } = useUiCopy()
  const { id } = Route.useParams()
  const { data } = useSuspenseCategory(id)
  const { data: tree } = useSuspenseCategoryTree()
  const navigate = useNavigate()
  // `mutate`, not `mutateAsync`: a refusal (the Category still has children) is reported by the hook's toast.
  const { mutate: deleteCategory } = useDeleteCategory(id)
  const prompt = usePrompt()

  const category = data.productCategory
  const parent = flattenCategoryTree(tree.productCategories).find((row) => row.category.id === category.parentId)
  const parentPath = parent ? [...parent.ancestors, parent.category.name].join(' › ') : t`None — top-level`

  const handleDelete = async () => {
    const name = category.name
    const confirmed = await prompt({
      title: t`Delete category`,
      description: t`You are about to delete the category ${name}.`,
      confirmText: t`Delete`,
      cancelText: cancel,
      variant: 'danger',
    })
    if (!confirmed) return

    deleteCategory(undefined, {
      onSuccess: () => navigate({ to: '/categories' }),
    })
  }

  return (
    <PageLayout.SingleColumn>
      <Card className="gap-0 divide-y py-0">
        <CardHeader>
          <CardTitle>{category.name}</CardTitle>
          <CardAction className="flex items-center gap-x-3">
            <ActionMenu
              groups={[
                { actions: [{ label: t`Edit`, to: './edit', icon: <PencilIcon /> }] },
                { actions: [{ label: t`Delete`, onClick: handleDelete, icon: <TrashIcon /> }] },
              ]}
            />
          </CardAction>
        </CardHeader>
        <SectionRow title={t`Handle`} value={category.handle} />
        <SectionRow title={t`Description`} value={category.description || '-'} />
        <SectionRow title={t`Parent`} value={parentPath} />
        <SectionRow title={t`Active`} description={t`Shown on the store.`} value={category.isActive ? t`Yes` : t`No`} />
        <SectionRow
          title={t`Internal`}
          description={t`Assignable to products here, never shown on the store.`}
          value={category.isInternal ? t`Yes` : t`No`}
        />
      </Card>
    </PageLayout.SingleColumn>
  )
}

import { RouteFocusModal } from '@proteus/ui'
import { createFileRoute } from '@tanstack/react-router'
import { categoryTreeQueryOptions } from '#/features/categories/api/categories'
import { CreateCategoryForm } from '#/features/categories/components/create-category-form'

export const Route = createFileRoute('/_authed/_shell/categories/create')({
  // The parent picker lists the whole tree.
  loader: ({ context }) => context.queryClient.ensureQueryData(categoryTreeQueryOptions()),
  component: CreateCategoryRoute,
})

function CreateCategoryRoute() {
  return (
    <RouteFocusModal>
      <CreateCategoryForm />
    </RouteFocusModal>
  )
}

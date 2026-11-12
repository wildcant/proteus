import { RouteDrawer } from '@proteus/ui'
import { createFileRoute } from '@tanstack/react-router'
import { categoryQueryOptions, useSuspenseCategory } from '#/features/categories/api/categories'
import { EditCategoryForm } from '#/features/categories/components/edit-category-form'

export const Route = createFileRoute('/_authed/_shell/categories/$id/_detail/edit')({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(categoryQueryOptions(params.id)),
  component: EditCategoryRoute,
})

function EditCategoryRoute() {
  const { id } = Route.useParams()
  const { data } = useSuspenseCategory(id)

  return (
    <RouteDrawer>
      <EditCategoryForm category={data.productCategory} />
    </RouteDrawer>
  )
}

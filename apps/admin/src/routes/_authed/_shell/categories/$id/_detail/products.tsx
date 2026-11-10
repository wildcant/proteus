import { RouteFocusModal } from '@proteus/ui'
import { createFileRoute } from '@tanstack/react-router'
import { categoryQueryOptions, useSuspenseCategory } from '#/features/categories/api/categories'
import { EditCategoryProductsForm } from '#/features/categories/components/edit-category-products-form'
import { productIdsInCategoryQueryOptions, useSuspenseProductIdsInCategory } from '#/features/products/api/products'

export const Route = createFileRoute('/_authed/_shell/categories/$id/_detail/products')({
  // The current members are what the picker opens pre-checked, so they have to be known first.
  loader: ({ context, params }) =>
    Promise.all([
      context.queryClient.ensureQueryData(categoryQueryOptions(params.id)),
      context.queryClient.ensureQueryData(productIdsInCategoryQueryOptions(params.id)),
    ]),
  component: EditCategoryProductsRoute,
})

function EditCategoryProductsRoute() {
  const { id } = Route.useParams()
  const { data } = useSuspenseCategory(id)
  const { data: memberIds } = useSuspenseProductIdsInCategory(id)

  return (
    <RouteFocusModal>
      <EditCategoryProductsForm categoryId={id} categoryName={data.productCategory.name} memberIds={memberIds} />
    </RouteFocusModal>
  )
}

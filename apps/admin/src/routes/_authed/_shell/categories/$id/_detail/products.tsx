import { RouteFocusModal } from '@proteus/ui'
import { createFileRoute } from '@tanstack/react-router'
import { categoryQueryOptions, useSetCategoryProducts, useSuspenseCategory } from '#/features/categories/api/categories'
import { productIdsQueryOptions, useSuspenseProductIds } from '#/features/products/api/products'
import { EditProductGroupForm } from '#/features/products/components/edit-product-group-form'

export const Route = createFileRoute('/_authed/_shell/categories/$id/_detail/products')({
  // The current members are what the picker opens pre-checked, so they have to be known first.
  loader: ({ context, params }) =>
    Promise.all([
      context.queryClient.ensureQueryData(categoryQueryOptions(params.id)),
      context.queryClient.ensureQueryData(productIdsQueryOptions({ categoryId: params.id })),
    ]),
  component: EditCategoryProductsRoute,
})

function EditCategoryProductsRoute() {
  const { id } = Route.useParams()
  const { data } = useSuspenseCategory(id)
  const { data: memberIds } = useSuspenseProductIds({ categoryId: id })
  const { mutateAsync: setMembers } = useSetCategoryProducts(id)

  return (
    <RouteFocusModal>
      <EditProductGroupForm groupName={data.productCategory.name} memberIds={memberIds} setMembers={setMembers} />
    </RouteFocusModal>
  )
}

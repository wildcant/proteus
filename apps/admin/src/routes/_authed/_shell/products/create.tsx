import { RouteFocusModal } from '@proteus/ui'
import { createFileRoute } from '@tanstack/react-router'
import { categoryTreeQueryOptions } from '#/features/categories/api/categories'
import { allCollectionsQueryOptions } from '#/features/collections/api/collections'
import { CreateProductForm } from '#/features/products/components/create-product-form/create-product-form'

export const Route = createFileRoute('/_authed/_shell/products/create')({
  // The Organize step's category picker browses the whole tree, and its Collections offer every one.
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(categoryTreeQueryOptions()),
      context.queryClient.ensureQueryData(allCollectionsQueryOptions()),
    ]),
  component: CreateProductRoute,
})

function CreateProductRoute() {
  return (
    <RouteFocusModal>
      <CreateProductForm />
    </RouteFocusModal>
  )
}

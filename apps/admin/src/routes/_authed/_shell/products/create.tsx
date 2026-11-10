import { RouteFocusModal } from '@proteus/ui'
import { createFileRoute } from '@tanstack/react-router'
import { categoryTreeQueryOptions } from '#/features/categories/api/categories'
import { allCollectionsQueryOptions } from '#/features/collections/api/collections'
import { allProductTypesQueryOptions } from '#/features/product-types/api/product-types'
import { CreateProductForm } from '#/features/products/components/create-product-form/create-product-form'

export const Route = createFileRoute('/_authed/_shell/products/create')({
  // The Organize step's category picker browses the whole tree; its Collections and Type offer every row.
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(categoryTreeQueryOptions()),
      context.queryClient.ensureQueryData(allCollectionsQueryOptions()),
      context.queryClient.ensureQueryData(allProductTypesQueryOptions()),
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

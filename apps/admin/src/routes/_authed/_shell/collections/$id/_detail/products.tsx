import { RouteFocusModal } from '@proteus/ui'
import { createFileRoute } from '@tanstack/react-router'
import { collectionQueryOptions, useSuspenseCollection } from '#/features/collections/api/collections'
import { EditCollectionProductsForm } from '#/features/collections/components/edit-collection-products-form'
import { productIdsInCollectionQueryOptions, useSuspenseProductIdsInCollection } from '#/features/products/api/products'

export const Route = createFileRoute('/_authed/_shell/collections/$id/_detail/products')({
  // The current members are what the picker opens pre-checked, so they have to be known first.
  loader: ({ context, params }) =>
    Promise.all([
      context.queryClient.ensureQueryData(collectionQueryOptions(params.id)),
      context.queryClient.ensureQueryData(productIdsInCollectionQueryOptions(params.id)),
    ]),
  component: EditCollectionProductsRoute,
})

function EditCollectionProductsRoute() {
  const { id } = Route.useParams()
  const { data } = useSuspenseCollection(id)
  const { data: memberIds } = useSuspenseProductIdsInCollection(id)

  return (
    <RouteFocusModal>
      <EditCollectionProductsForm collectionId={id} collectionTitle={data.collection.title} memberIds={memberIds} />
    </RouteFocusModal>
  )
}

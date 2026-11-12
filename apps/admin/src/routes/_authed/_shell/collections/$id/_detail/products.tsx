import { RouteFocusModal } from '@proteus/ui'
import { createFileRoute } from '@tanstack/react-router'
import {
  collectionQueryOptions,
  useSetCollectionProducts,
  useSuspenseCollection,
} from '#/features/collections/api/collections'
import { productIdsQueryOptions, useSuspenseProductIds } from '#/features/products/api/products'
import { EditProductGroupForm } from '#/features/products/components/edit-product-group-form'

export const Route = createFileRoute('/_authed/_shell/collections/$id/_detail/products')({
  // The current members are what the picker opens pre-checked, so they have to be known first.
  loader: ({ context, params }) =>
    Promise.all([
      context.queryClient.ensureQueryData(collectionQueryOptions(params.id)),
      context.queryClient.ensureQueryData(productIdsQueryOptions({ collectionId: params.id })),
    ]),
  component: EditCollectionProductsRoute,
})

function EditCollectionProductsRoute() {
  const { id } = Route.useParams()
  const { data } = useSuspenseCollection(id)
  const { data: memberIds } = useSuspenseProductIds({ collectionId: id })
  const { mutateAsync: setMembers } = useSetCollectionProducts(id)

  return (
    <RouteFocusModal>
      <EditProductGroupForm groupName={data.collection.title} memberIds={memberIds} setMembers={setMembers} />
    </RouteFocusModal>
  )
}

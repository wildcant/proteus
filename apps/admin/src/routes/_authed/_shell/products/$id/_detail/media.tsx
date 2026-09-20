import { RouteFocusModal } from '@proteus/ui'
import { createFileRoute } from '@tanstack/react-router'
import { useSuspenseProduct } from '#/features/products/api/products'
import { EditProductMediaForm } from '#/features/products/components/media/edit-product-media-form'

export const Route = createFileRoute('/_authed/_shell/products/$id/_detail/media')({
  component: EditProductMediaRoute,
})

function EditProductMediaRoute() {
  const { id } = Route.useParams()
  const { data } = useSuspenseProduct(id)

  return (
    <RouteFocusModal>
      <EditProductMediaForm product={data.product} />
    </RouteFocusModal>
  )
}

import { RouteFocusModal } from '@proteus/ui'
import { createFileRoute } from '@tanstack/react-router'
import { CreateVariantForm } from '#/features/products/components/variant/create-variant-form'

export const Route = createFileRoute('/_authed/_shell/products/$id/variants/create')({
  component: CreateVariantRoute,
})

function CreateVariantRoute() {
  const { id } = Route.useParams()

  // The default `..` would only strip `/create`, landing on `/variants`, which is not a page —
  // this modal is opened from the product detail and belongs back there, on save and on close.
  return (
    <RouteFocusModal prev={`/products/${id}`}>
      <CreateVariantForm productId={id} />
    </RouteFocusModal>
  )
}

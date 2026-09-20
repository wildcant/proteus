import { RouteFocusModal } from '@proteus/ui'
import { createFileRoute } from '@tanstack/react-router'
import { useSuspenseProductVariant } from '#/features/products/api/product-variants'
import { useSuspenseProduct } from '#/features/products/api/products'
import { EditVariantMediaForm } from '#/features/products/components/variant/edit-variant-media-form'

export const Route = createFileRoute('/_authed/_shell/products/$id/variants/$variantId/media')({
  component: EditVariantMediaRoute,
})

function EditVariantMediaRoute() {
  const { id, variantId } = Route.useParams()
  const { data: variantData } = useSuspenseProductVariant(id, variantId)
  const { data: productData } = useSuspenseProduct(id)

  return (
    <RouteFocusModal>
      <EditVariantMediaForm
        productId={id}
        variant={variantData.variant}
        productImages={productData.product.images ?? []}
      />
    </RouteFocusModal>
  )
}

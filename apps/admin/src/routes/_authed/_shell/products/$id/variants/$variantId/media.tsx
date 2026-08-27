import { RouteFocusModal } from '@proteus/ui'
import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { productVariantQueryOptions } from '#/features/products/api/product-variants'
import { productQueryOptions } from '#/features/products/api/products'
import { EditVariantMediaForm } from '#/features/products/components/variant/edit-variant-media-form'

export const Route = createFileRoute('/_authed/_shell/products/$id/variants/$variantId/media')({
  component: EditVariantMediaRoute,
})

function EditVariantMediaRoute() {
  const { id, variantId } = Route.useParams()
  const { data: variantData } = useSuspenseQuery(productVariantQueryOptions(id, variantId))
  const { data: productData } = useSuspenseQuery(productQueryOptions(id))

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

import { RouteFocusModal } from '@proteus/ui'
import { createFileRoute } from '@tanstack/react-router'
import { useSuspenseProductVariant } from '#/features/products/api/product-variants'
import { VariantPriceEditForm } from '#/features/products/components/variant/variant-price-edit-form'

export const Route = createFileRoute('/_authed/_shell/products/$id/variants/$variantId/prices')({
  component: VariantPricesRoute,
})

function VariantPricesRoute() {
  const { id, variantId } = Route.useParams()
  const { data } = useSuspenseProductVariant(id, variantId)

  return (
    <RouteFocusModal>
      <VariantPriceEditForm productId={id} variant={data.variant} />
    </RouteFocusModal>
  )
}

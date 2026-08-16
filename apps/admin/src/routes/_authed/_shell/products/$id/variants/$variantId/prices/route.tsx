import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { RouteFocusModal } from '#/components/modals/route-focus-modal/route-focus-modal'
import { productVariantQueryOptions } from '#/features/products/api/product-variants'
import { VariantPriceEditForm } from '#/features/products/components/variant-price-edit-form'

export const Route = createFileRoute('/_authed/_shell/products/$id/variants/$variantId/prices')({
  component: VariantPricesRoute,
})

function VariantPricesRoute() {
  const { id, variantId } = Route.useParams()
  const { data } = useSuspenseQuery(productVariantQueryOptions(id, variantId))

  return (
    <RouteFocusModal>
      <VariantPriceEditForm productId={id} variant={data.variant} />
    </RouteFocusModal>
  )
}

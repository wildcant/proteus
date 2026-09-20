import { RouteFocusModal } from '@proteus/ui'
import { createFileRoute } from '@tanstack/react-router'
import { useSuspenseProductVariant } from '#/features/products/api/product-variants'
import { VariantStockEditForm } from '#/features/products/components/variant/variant-stock-edit-form'

export const Route = createFileRoute('/_authed/_shell/products/$id/variants/$variantId/stock')({
  component: VariantStockRoute,
})

function VariantStockRoute() {
  const { id, variantId } = Route.useParams()
  const { data } = useSuspenseProductVariant(id, variantId)

  return (
    <RouteFocusModal>
      <VariantStockEditForm productId={id} variant={data.variant} />
    </RouteFocusModal>
  )
}

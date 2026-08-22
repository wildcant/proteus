import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { RouteDrawer } from '#/components/modals/route-drawer/route-drawer'
import { productVariantQueryOptions } from '#/features/products/api/product-variants'
import { EditVariantForm } from '#/features/products/components/variant/edit-variant-form'

export const Route = createFileRoute('/_authed/_shell/products/$id/variants/$variantId/edit')({
  component: EditVariantRoute,
})

function EditVariantRoute() {
  const { id, variantId } = Route.useParams()
  // Suspending on the variant keeps the form's defaults final on first render. The combinations
  // load inside the form, since the combobox has its own loading state anyway.
  const { data: variantData } = useSuspenseQuery(productVariantQueryOptions(id, variantId))

  return (
    <RouteDrawer>
      <EditVariantForm productId={id} variant={variantData.variant} />
    </RouteDrawer>
  )
}

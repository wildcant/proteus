import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { RouteDrawer } from '#/components/modals/route-drawer/route-drawer'
import { productOptionsForProductQueryOptions } from '#/features/product-options/api/product-options'
import { productVariantQueryOptions } from '#/features/products/api/product-variants'
import { EditVariantForm } from '#/features/products/components/variant/edit-variant-form'

export const Route = createFileRoute('/_authed/_shell/products/$id/variants/$variantId/edit')({
  component: EditVariantRoute,
})

function EditVariantRoute() {
  const { id, variantId } = Route.useParams()
  // Suspending on both keeps the option selects' default values final on first render, so a save
  // never submits a tuple built from an empty option list.
  const { data: variantData } = useSuspenseQuery(productVariantQueryOptions(id, variantId))
  const { data: optionsData } = useSuspenseQuery(productOptionsForProductQueryOptions(id))

  return (
    <RouteDrawer>
      <EditVariantForm productId={id} variant={variantData.variant} options={optionsData.productOptions} />
    </RouteDrawer>
  )
}

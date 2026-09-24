import { Trans } from '@lingui/react/macro'
import { RouteDrawer } from '@proteus/ui'
import { createFileRoute } from '@tanstack/react-router'
import { useSuspenseImageVariants } from '#/features/products/api/product-variants'
import { useSuspenseProduct } from '#/features/products/api/products'
import { ManageImageVariantsForm } from '#/features/products/components/media/manage-image-variants-form'
import { useUiCopy } from '#/hooks/use-ui-copy'

export const Route = createFileRoute('/_authed/_shell/products/$id/_detail/images/$imageId/variants')({
  component: ManageImageVariantsRoute,
})

function ManageImageVariantsRoute() {
  const { closeLabel } = useUiCopy()
  const { id, imageId } = Route.useParams()
  // Suspending keeps the form's default values final on its first render, so the save diff is
  // computed against the real association set rather than an empty one.
  const { data: product } = useSuspenseProduct(id)
  const { data: association } = useSuspenseImageVariants(id, imageId)

  const image = product.product.images?.find((candidate) => candidate.id === imageId)

  // The default `..` would only strip `/variants`, landing on the image segment, which is not
  // a page — this drawer is opened from the product detail and belongs back there.
  return (
    <RouteDrawer size="wide" prev={`/products/${id}`}>
      {image ? (
        <ManageImageVariantsForm
          productId={id}
          image={image}
          variantIds={association.variants.map((variant) => variant.id)}
        />
      ) : (
        <>
          <RouteDrawer.Header closeLabel={closeLabel}>
            <RouteDrawer.Title>
              <Trans>Image not found</Trans>
            </RouteDrawer.Title>
            <RouteDrawer.Description>
              <Trans>This product has no image with that id.</Trans>
            </RouteDrawer.Description>
          </RouteDrawer.Header>
          <RouteDrawer.Body />
        </>
      )}
    </RouteDrawer>
  )
}

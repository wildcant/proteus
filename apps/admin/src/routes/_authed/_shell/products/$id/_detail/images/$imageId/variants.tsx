import { RouteDrawer } from '@proteus/ui'
import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { imageVariantsQueryOptions } from '#/features/products/api/product-variants'
import { productQueryOptions } from '#/features/products/api/products'
import { ManageImageVariantsForm } from '#/features/products/components/media/manage-image-variants-form'

export const Route = createFileRoute('/_authed/_shell/products/$id/_detail/images/$imageId/variants')({
  component: ManageImageVariantsRoute,
})

function ManageImageVariantsRoute() {
  const { id, imageId } = Route.useParams()
  // Suspending keeps the form's default values final on its first render, so the save diff is
  // computed against the real association set rather than an empty one.
  const { data: product } = useSuspenseQuery(productQueryOptions(id))
  const { data: association } = useSuspenseQuery(imageVariantsQueryOptions(id, imageId))

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
          <RouteDrawer.Header>
            <RouteDrawer.Title>Image not found</RouteDrawer.Title>
            <RouteDrawer.Description>This product has no image with that id.</RouteDrawer.Description>
          </RouteDrawer.Header>
          <RouteDrawer.Body />
        </>
      )}
    </RouteDrawer>
  )
}

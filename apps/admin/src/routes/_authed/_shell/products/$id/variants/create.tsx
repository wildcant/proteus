import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { RouteFocusModal } from '#/components/modals/route-focus-modal/route-focus-modal'
import { productOptionsForProductQueryOptions } from '#/features/product-options/api/product-options'
import { productVariantsListQueryOptions } from '#/features/products/api/product-variants'
import { CreateVariantsForm } from '#/features/products/components/variant/create-variants-form'

export const Route = createFileRoute('/_authed/_shell/products/$id/variants/create')({
  component: CreateVariantsRoute,
})

function CreateVariantsRoute() {
  const { id } = Route.useParams()
  // Suspending on both keeps the generated matrix final on its first render: the options decide
  // what can be built, and the existing variants decide which combinations are already taken.
  const { data: optionsData } = useSuspenseQuery(productOptionsForProductQueryOptions(id))
  // 100 is the API's pagination ceiling. A product with more variants than that would need a
  // paged read here; nothing in the catalogue comes close today.
  const { data: variantsData } = useSuspenseQuery(productVariantsListQueryOptions(id, { limit: 100 }))

  // The default `..` would only strip `/create`, landing on `/variants`, which is not a page —
  // this modal is opened from the product detail and belongs back there, on save and on close.
  return (
    <RouteFocusModal prev={`/products/${id}`}>
      <CreateVariantsForm
        productId={id}
        options={optionsData.productOptions}
        existingVariants={variantsData.variants}
      />
    </RouteFocusModal>
  )
}

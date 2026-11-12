import { useLingui } from '@lingui/react/macro'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { SingleColumnPageSkeleton } from '#/components/common/skeleton'
import { PageLayout } from '#/components/layout/page-layout'
import { ValueEntityCard } from '#/components/value-entity/value-entity-card'
import {
  productTagQueryOptions,
  useDeleteProductTag,
  useSuspenseProductTag,
} from '#/features/product-tags/api/product-tags'
import { ProductGroupSection } from '#/features/products/components/product-group-section'

export const Route = createFileRoute('/_authed/_shell/product-tags/$id/_detail')({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(productTagQueryOptions(params.id)),
  pendingComponent: () => <SingleColumnPageSkeleton sections={2} />,
  component: ProductTagDetailLayout,
})

function ProductTagDetailLayout() {
  const { t } = useLingui()
  const { id } = Route.useParams()
  const { data } = useSuspenseProductTag(id)
  const navigate = useNavigate()
  const { mutate: deleteTag } = useDeleteProductTag(id)

  const value = data.tag.value

  return (
    <PageLayout.SingleColumn>
      <ValueEntityCard
        value={value}
        deletePrompt={{ title: t`Delete tag`, description: t`You are about to delete the tag ${value}.` }}
        onDelete={() => deleteTag(undefined, { onSuccess: () => navigate({ to: '/product-tags' }) })}
      />
      {/* Read-only: a product's Tags are set from the product. */}
      <ProductGroupSection filter={{ tagId: id }} emptyDescription={t`Add this tag to a product to list it here.`} />
    </PageLayout.SingleColumn>
  )
}

import { useLingui } from '@lingui/react/macro'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { SingleColumnPageSkeleton } from '#/components/common/skeleton'
import { PageLayout } from '#/components/layout/page-layout'
import { ValueEntityCard } from '#/components/value-entity/value-entity-card'
import {
  productTypeQueryOptions,
  useDeleteProductType,
  useSuspenseProductType,
} from '#/features/product-types/api/product-types'
import { ProductGroupSection } from '#/features/products/components/product-group-section'

export const Route = createFileRoute('/_authed/_shell/product-types/$id/_detail')({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(productTypeQueryOptions(params.id)),
  pendingComponent: () => <SingleColumnPageSkeleton sections={2} />,
  component: ProductTypeDetailLayout,
})

function ProductTypeDetailLayout() {
  const { t } = useLingui()
  const { id } = Route.useParams()
  const { data } = useSuspenseProductType(id)
  const navigate = useNavigate()
  const { mutate: deleteType } = useDeleteProductType(id)

  const value = data.type.value

  return (
    <PageLayout.SingleColumn>
      <ValueEntityCard
        value={value}
        deletePrompt={{ title: t`Delete type`, description: t`You are about to delete the type ${value}.` }}
        onDelete={() => deleteType(undefined, { onSuccess: () => navigate({ to: '/product-types' }) })}
      />
      {/* Read-only: a product's Type is set from the product. */}
      <ProductGroupSection filter={{ typeId: id }} emptyDescription={t`Set this type on a product to list it here.`} />
    </PageLayout.SingleColumn>
  )
}

import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { TwoColumnPageSkeleton } from '#/components/common/skeleton'
import { PageLayout } from '#/components/layout/page-layout'
import { productVariantQueryOptions } from '#/features/products/api/product-variants'
import { VariantGeneralSection } from '#/features/products/components/variant/variant-general-section'
import { VariantMediaSection } from '#/features/products/components/variant/variant-media-section'
import { VariantPricesSection } from '#/features/products/components/variant/variant-prices-section'

export const Route = createFileRoute('/_authed/_shell/products/$id/variants/$variantId')({
  beforeLoad: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(productVariantQueryOptions(params.id, params.variantId))
    return { breadcrumb: data.variant.title }
  },
  pendingComponent: () => <TwoColumnPageSkeleton mainSections={1} sidebarSections={1} />,
  component: VariantDetailLayout,
})

function VariantDetailLayout() {
  const { id, variantId } = Route.useParams()
  const { data } = useSuspenseQuery(productVariantQueryOptions(id, variantId))

  return (
    <PageLayout.TwoColumn>
      <PageLayout.TwoColumn.Main>
        <VariantGeneralSection productId={id} variant={data.variant} />
        <VariantMediaSection variant={data.variant} />
      </PageLayout.TwoColumn.Main>
      <PageLayout.TwoColumn.Side>
        <VariantPricesSection variant={data.variant} />
      </PageLayout.TwoColumn.Side>
    </PageLayout.TwoColumn>
  )
}

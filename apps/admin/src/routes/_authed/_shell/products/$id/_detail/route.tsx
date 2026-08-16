import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Outlet } from '@tanstack/react-router'
import { TwoColumnPageSkeleton } from '#/components/common/skeleton'
import { PageLayout } from '#/components/layout/page-layout'
import { productQueryOptions } from '#/features/products/api/products'
import { ProductAttributeSection } from '#/features/products/components/product-attribute-section'
import { ProductGeneralSection } from '#/features/products/components/product-general-section'
import { ProductVariantSection } from '#/features/products/components/product-variant-section'

export const Route = createFileRoute('/_authed/_shell/products/$id/_detail')({
  pendingComponent: () => <TwoColumnPageSkeleton mainSections={1} sidebarSections={1} />,
  component: ProductDetailLayout,
})

function ProductDetailLayout() {
  const { id } = Route.useParams()
  const { data } = useSuspenseQuery(productQueryOptions(id))

  return (
    <>
      <PageLayout.TwoColumn>
        <PageLayout.TwoColumn.Main>
          <ProductGeneralSection product={data.product} />
          <ProductVariantSection productId={id} />
        </PageLayout.TwoColumn.Main>
        <PageLayout.TwoColumn.Side>
          <ProductAttributeSection product={data.product} />
        </PageLayout.TwoColumn.Side>
      </PageLayout.TwoColumn>
      <Outlet />
    </>
  )
}

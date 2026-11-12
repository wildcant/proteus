import { createFileRoute } from '@tanstack/react-router'
import { TwoColumnPageSkeleton } from '#/components/common/skeleton'
import { PageLayout } from '#/components/layout/page-layout'
import { categoryTreeQueryOptions } from '#/features/categories/api/categories'
import { ProductOptionSection } from '#/features/product-options/components/product-option-section'
import { useSuspenseProduct } from '#/features/products/api/products'
import { ProductMediaSection } from '#/features/products/components/media/product-media-section'
import { ProductAttributeSection } from '#/features/products/components/product-attribute-section'
import { ProductGeneralSection } from '#/features/products/components/product-general-section'
import { ProductOrganizationSection } from '#/features/products/components/product-organization-section'
import { ProductVariantSection } from '#/features/products/components/product-variant-section'

export const Route = createFileRoute('/_authed/_shell/products/$id/_detail')({
  // The Organization card names each Category by its path through the tree.
  loader: ({ context }) => context.queryClient.ensureQueryData(categoryTreeQueryOptions()),
  pendingComponent: () => <TwoColumnPageSkeleton mainSections={1} sidebarSections={2} />,
  component: ProductDetailLayout,
})

function ProductDetailLayout() {
  const { id } = Route.useParams()
  const { data } = useSuspenseProduct(id)

  return (
    <PageLayout.TwoColumn>
      <PageLayout.TwoColumn.Main>
        <ProductGeneralSection product={data.product} />
        <ProductMediaSection product={data.product} />
        <ProductOptionSection productId={id} />
        <ProductVariantSection productId={id} />
      </PageLayout.TwoColumn.Main>
      <PageLayout.TwoColumn.Side>
        <ProductOrganizationSection product={data.product} />
        <ProductAttributeSection product={data.product} />
      </PageLayout.TwoColumn.Side>
    </PageLayout.TwoColumn>
  )
}

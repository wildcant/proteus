import { createFileRoute } from '@tanstack/react-router'
import { Suspense } from 'react'
import { z } from 'zod'
import { productQueryOptions } from '#/features/products/api/products'
import { ProductDetail } from '#/features/products/components/product-detail'
import { ProductDetailSkeleton } from '#/features/products/components/product-detail-skeleton'
import { ProductError } from '#/features/products/components/product-error'
import { marketHeadLinksFor } from '#/lib/seo/market-links'

/** Keeps the chosen variant shareable — a link to a colourway renders that colourway on the server. */
const productSearchSchema = z.object({
  variant: z.string().optional(),
})

export const Route = createFileRoute('/_main/products/$productId')({
  ssr: true,
  head: (context) => ({ links: marketHeadLinksFor(context) }),
  validateSearch: productSearchSchema,
  component: ProductDetailPage,
  // Contains the read to this match, so a failure takes the panel and not the document — the
  // header, the bag and the market notice keep rendering around it. Only a genuine failure arrives
  // here: a product this market cannot price answers 404, which the query resolves as an absent
  // product for `ProductDetail` to render.
  errorComponent: ProductError,
  loader: async ({ context, params }) => {
    // See the list route: the market's country is what the price on this page is quoted in.
    await context.queryClient.ensureQueryData(
      productQueryOptions(params.productId, { countryCode: context.market.current.iso2 }),
    )
  },
  headers: () => ({
    // Shorter cache due to inventory changes
    'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
  }),
  staleTime: 30_000,
})

function ProductDetailPage() {
  return (
    <Suspense fallback={<ProductDetailSkeleton />}>
      <ProductDetail />
    </Suspense>
  )
}

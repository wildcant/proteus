import { Trans } from '@lingui/react/macro'
import { createFileRoute } from '@tanstack/react-router'
import { Suspense } from 'react'
import { ButtonLink } from '#/components/button'
import { collectionQueryOptions, useSuspenseCollection } from '#/features/products/api/collections'
import { type ProductListScope, productsListQueryOptions, productsPageQuery } from '#/features/products/api/products'
import { CollectionHero } from '#/features/products/components/collection-hero'
import { ProductList } from '#/features/products/components/product-list'
import { ProductListHeader } from '#/features/products/components/product-list-header'
import { ProductListNotFound } from '#/features/products/components/product-list-not-found'
import { ProductListSkeleton } from '#/features/products/components/product-list-skeleton'
import { type ProductListView, productListSearchSchema } from '#/features/products/utils/product-list-search'
import { marketHeadLinksFor } from '#/lib/seo/market-links'

const scopeFor = (handle: string): ProductListScope => ({ collection: handle })

export const Route = createFileRoute('/_main/collections/$handle')({
  ssr: true,
  head: (context) => ({ links: marketHeadLinksFor(context) }),
  validateSearch: productListSearchSchema,
  component: CollectionPage,
  // See the home route: a param the loader does not see is one the server renders wrong.
  loaderDeps: ({ search }) => ({ q: search.q, sort: search.sort, offset: search.offset }),
  loader: async ({ context, deps, params }) => {
    const query = productsPageQuery({
      ...deps,
      scope: scopeFor(params.handle),
      countryCode: context.market.current.iso2,
    })
    // In parallel, not Collection first: the list is filtered by the same handle, so an unknown
    // one costs an empty page rather than a second round trip on every known one.
    await Promise.all([
      context.queryClient.ensureQueryData(collectionQueryOptions(params.handle)),
      context.queryClient.ensureQueryData(productsListQueryOptions(query)),
    ])
  },
  headers: () => ({
    'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
  }),
  staleTime: 30_000,
})

function CollectionPage() {
  const { handle } = Route.useParams()
  const navigate = Route.useNavigate()
  const search = Route.useSearch()
  const { collection } = useSuspenseCollection(handle)

  if (!collection) {
    return (
      <ProductListNotFound
        heading={<Trans>We couldn't find this collection</Trans>}
        body={<Trans>It may have ended, or no longer be in the store.</Trans>}
      />
    )
  }

  const list: ProductListView = {
    scope: scopeFor(handle),
    search,
    onSearchChange: (update) => navigate({ search: (previous) => ({ ...previous, ...update }) }),
  }

  return (
    <main className="mx-auto w-full max-w-350 px-4 pt-8 pb-16 sm:px-6 lg:px-8">
      <ProductListHeader {...list} heading={collection.title}>
        {search.q ? null : <CollectionHero collection={collection} />}
      </ProductListHeader>

      <div className="mt-6">
        <Suspense fallback={<ProductListSkeleton />}>
          <ProductList
            {...list}
            emptyLink={
              <ButtonLink to="/">
                <Trans>Shop all</Trans>
              </ButtonLink>
            }
          />
        </Suspense>
      </div>
    </main>
  )
}

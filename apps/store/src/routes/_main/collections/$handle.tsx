import { Trans } from '@lingui/react/macro'
import { createFileRoute, notFound } from '@tanstack/react-router'
import { collectionQueryOptions, useSuspenseCollection } from '#/features/products/api/collections'
import { ensureProductListData } from '#/features/products/api/product-list'
import type { ProductListScope } from '#/features/products/api/products'
import { CollectionHero } from '#/features/products/components/collection-hero/collection-hero'
import { ProductListNotFound } from '#/features/products/components/product-list-not-found/product-list-not-found'
import { ProductListPage } from '#/features/products/components/product-list-page/product-list-page'
import type { ProductListLinks } from '#/features/products/types/links'
import { productListRouteOptions } from '#/features/products/utils/product-list-route'
import { flowLinks } from '#/navigation/links'

const links = flowLinks('ProductListPage')
const listLinks: ProductListLinks = {
  product: (handle) => links.PRODUCT({ params: { handle } }),
  shopAll: links.SHOP_ALL(),
  // These stay on whichever list route is showing: the home page, a category or a collection.
  filter: links.FILTER,
  tag: links.TAG,
  sort: links.SORT,
  page: links.PAGE,
  clearFilters: links.CLEAR_FILTERS,
  clearSearch: links.CLEAR_SEARCH,
}

const scopeFor = (handle: string): ProductListScope => ({ collection: handle })

export const Route = createFileRoute('/_main/collections/$handle')({
  ssr: true,
  ...productListRouteOptions,
  component: CollectionPage,
  notFoundComponent: CollectionNotFound,
  loader: async ({ context, deps, params }) => {
    // In parallel, not Collection first: the list is filtered by the same handle, so an unknown
    // one costs an empty page rather than a second round trip on every known one.
    const [{ collection }] = await Promise.all([
      context.queryClient.ensureQueryData(collectionQueryOptions(params.handle)),
      ensureProductListData(context, { ...deps, scope: scopeFor(params.handle) }),
    ])
    if (!collection) throw notFound()
  },
})

function CollectionPage() {
  const { handle } = Route.useParams()
  const search = Route.useSearch()
  const { collection } = useSuspenseCollection(handle)
  // Refetched without it since the loader ran.
  if (!collection) throw notFound()

  return (
    <ProductListPage
      links={listLinks}
      scope={scopeFor(handle)}
      search={search}
      heading={collection.title}
      // `mt-2` on top of the header intro slot's `gap-4`: 24px under the title.
      intro={<CollectionHero collection={collection} className="mt-2" />}
    />
  )
}

function CollectionNotFound() {
  return (
    <ProductListNotFound
      shopAllLink={links.SHOP_ALL()}
      heading={<Trans>We couldn't find this collection</Trans>}
      body={<Trans>It may have ended, or no longer be in the store.</Trans>}
    />
  )
}

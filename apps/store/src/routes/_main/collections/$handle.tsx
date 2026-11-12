import { Trans } from '@lingui/react/macro'
import { createFileRoute, notFound } from '@tanstack/react-router'
import { collectionQueryOptions, useSuspenseCollection } from '#/features/products/api/collections'
import { ensureProductListData } from '#/features/products/api/product-list'
import type { ProductListScope } from '#/features/products/api/products'
import { CollectionHero } from '#/features/products/components/collection-hero'
import { ProductListNotFound } from '#/features/products/components/product-list-not-found/product-list-not-found'
import { ProductListPage } from '#/features/products/components/product-list-page/product-list-page'
import { productListRouteOptions } from '#/features/products/utils/product-list-route'

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
      from={Route.fullPath}
      scope={scopeFor(handle)}
      search={search}
      heading={collection.title}
      intro={<CollectionHero collection={collection} />}
    />
  )
}

function CollectionNotFound() {
  return (
    <ProductListNotFound
      heading={<Trans>We couldn't find this collection</Trans>}
      body={<Trans>It may have ended, or no longer be in the store.</Trans>}
    />
  )
}

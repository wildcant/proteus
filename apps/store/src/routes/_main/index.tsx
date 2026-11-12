import { useLingui } from '@lingui/react/macro'
import { createFileRoute } from '@tanstack/react-router'
import { ensureProductListData } from '#/features/products/api/product-list'
import type { ProductListScope } from '#/features/products/api/products'
import { ProductListPage } from '#/features/products/components/product-list-page/product-list-page'
import type { ProductListLinks } from '#/features/products/types/links'
import { productListRouteOptions } from '#/features/products/utils/product-list-route'
import { flowLinks } from '#/navigation/links'

const links = flowLinks('ProductListPage')
const listLinks: ProductListLinks = {
  product: (productId) => links.PRODUCT({ params: { productId } }),
  shopAll: links.SHOP_ALL(),
}

/** The home page is the whole catalogue: nothing narrows it. */
const HOME_SCOPE: ProductListScope = {}

export const Route = createFileRoute('/_main/')({
  ssr: true,
  ...productListRouteOptions,
  component: ProductsPage,
  loader: ({ context, deps }) => ensureProductListData(context, { ...deps, scope: HOME_SCOPE }),
})

function ProductsPage() {
  const { t } = useLingui()
  return (
    <ProductListPage
      from={Route.fullPath}
      links={listLinks}
      scope={HOME_SCOPE}
      search={Route.useSearch()}
      heading={t`All products`}
    />
  )
}

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryHistory, createRootRoute, createRouter, RouterProvider } from '@tanstack/react-router'
import { expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import type { StoreCartLineItem } from '#/api/generated/model'
import { CartItem } from '#/features/cart/components/cart-item/cart-item'
import { I18nTestProvider } from '#/lib/i18n/test-i18n'
import { DEFAULT_MARKET, type MarketContext } from '#/lib/market'

/**
 * One bag line, handed the line item the cart API answers with. Nothing here changes the
 * quantity, so the line's mutations never leave the client and no endpoint of ours is faked.
 */

function lineItem(overrides: Partial<StoreCartLineItem>): StoreCartLineItem {
  return {
    id: 'cali_1',
    cartId: 'cart_1',
    title: 'Sport Shorts',
    subtitle: null,
    thumbnail: null,
    quantity: 1,
    variantId: 'variant_1',
    productId: 'prod_shorts',
    productTitle: 'Sport Shorts',
    productDescription: null,
    productSubtitle: null,
    productType: null,
    productHandle: 'sport-shorts',
    variantSku: null,
    variantBarcode: null,
    variantTitle: null,
    variantOptionValues: 'M',
    requiresShipping: true,
    isDiscountable: true,
    isGiftcard: false,
    isTaxInclusive: false,
    compareAtUnitPrice: '0',
    unitPrice: '46.00',
    lineTotal: '46.00',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    ...overrides,
  }
}

/** The PDP, as a plain path: this router has no such route. */
const productLink = (handle: string) => ({ to: `/products/${handle}` })

/**
 * A memory router for the line's `Link` and the market its price is formatted in, and a query
 * client for the quantity mutations. Neither answers a request in these tests.
 */
function renderLine(item: StoreCartLineItem) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const market: MarketContext = {
    current: DEFAULT_MARKET,
    markets: [DEFAULT_MARKET],
    defaultMarket: DEFAULT_MARKET,
    resolvedFromUrl: true,
  }
  const router = createRouter({
    routeTree: createRootRoute({
      component: () => (
        <ul>
          <CartItem item={item} currencyCode="usd" productLink={productLink} />
        </ul>
      ),
    }),
    history: createMemoryHistory({ initialEntries: ['/'] }),
    context: { queryClient, market },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      {/* The app's own router type is registered globally; this stub is deliberately not it. */}
      <RouterProvider router={router as never} />
    </QueryClientProvider>,
    { wrapper: I18nTestProvider },
  )
}

test('a line links to its product by the handle it was added with, and a line without one is plain text', async () => {
  const linked = await renderLine(lineItem({}))

  // By handle, not id: the product page is addressed by the readable half of the URL.
  await expect
    .element(page.getByRole('link', { name: 'Sport Shorts' }))
    .toHaveAttribute('href', '/products/sport-shorts')
  await linked.unmount()

  // A line saved without a handle keeps its title, with no page to link to.
  renderLine(lineItem({ productHandle: null }))
  await expect.element(page.getByText('Sport Shorts')).toBeVisible()
  await expect.element(page.getByRole('link', { name: 'Sport Shorts' })).not.toBeInTheDocument()
})

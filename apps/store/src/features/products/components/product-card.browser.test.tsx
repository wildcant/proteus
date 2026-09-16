import { createMemoryHistory, createRootRoute, createRouter, RouterProvider } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import type { StoreProductListItem } from '#/api/generated/model'
import { DEFAULT_MARKET, type MarketContext } from '#/lib/market'
import { ProductCard } from './product-card'
import { ProductGrid } from './product-grid'

/**
 * The card and the sheet it sits in, handed the list item the API already answers with.
 *
 * `soldOut` arrives at the product's grain rather than the variant's — the list ships no variants
 * at all — so the only claims here are what the card draws for it and what the grid does with a
 * product carrying it. Which products get the flag is `product.api.test.ts`.
 */

/** Enough of a market for `useFormatters` to pick a locale; no request is made for it. */
const market: MarketContext = { current: DEFAULT_MARKET, markets: [DEFAULT_MARKET], resolvedFromUrl: true }

/**
 * A memory router with the subject as its only route, the way `payment-methods-book-view` mounts
 * one: the card is a `Link` and the price is formatted for the router's market, and neither needs
 * the real route tree to answer.
 */
function renderInRouter(ui: ReactNode) {
  const router = createRouter({
    routeTree: createRootRoute({ component: () => <>{ui}</> }),
    history: createMemoryHistory({ initialEntries: ['/'] }),
    context: { market },
  })
  // The app's own router type is registered globally; this stub is deliberately not it.
  return render(<RouterProvider router={router as never} />)
}

function product(overrides: Partial<StoreProductListItem> & Pick<StoreProductListItem, 'id' | 'title'>) {
  return {
    handle: 'a-garment',
    subtitle: null,
    description: null,
    thumbnail: null,
    weight: null,
    length: null,
    height: null,
    width: null,
    originCountry: null,
    material: null,
    startingPrice: { id: 'price_1', currencyCode: 'usd', calculatedAmount: '46.00' },
    soldOut: false,
    ...overrides,
  } satisfies StoreProductListItem
}

test('a sold-out product wears the badge', async () => {
  await renderInRouter(<ProductCard product={product({ id: 'prod_gone', title: 'Sport Shorts', soldOut: true })} />)

  await expect.element(page.getByText('Sold out')).toBeVisible()
})

test('a product in stock carries no badge', async () => {
  await renderInRouter(<ProductCard product={product({ id: 'prod_here', title: 'Sport Shorts' })} />)

  // The card first, then the absence. An unanchored `not.toBeInTheDocument()` passes against a
  // component that has not rendered yet, which is the one way this claim could hold for a card
  // that badges everything.
  await expect.element(page.getByRole('heading', { name: 'Sport Shorts' })).toBeVisible()
  // The badge is the exception, so drawing one on every card would say nothing at all.
  await expect.element(page.getByText('Sold out')).not.toBeInTheDocument()
})

test('a sold-out product stays in the grid, in the place the API gave it', async () => {
  await renderInRouter(
    <ProductGrid
      products={[
        product({ id: 'prod_first', title: 'Linen Shirt' }),
        product({ id: 'prod_gone', title: 'Sport Shorts', soldOut: true }),
        product({ id: 'prod_last', title: 'Wool Coat' }),
      ]}
    />,
  )

  // Not filtered and not sunk to the end: unlike a product with no price in this market, which has
  // no amount to draw at all, a sold-out one renders fine — and dropping it discards an indexed URL
  // for the shopper who came looking for exactly it.
  await expect.element(page.getByRole('heading', { name: 'Sport Shorts' })).toBeVisible()

  const titles = page.getByRole('heading').elements()
  expect(titles.map((title) => title.textContent)).toEqual(['Linen Shirt', 'Sport Shorts', 'Wool Coat'])

  // One badge, on the card that earned it — the neighbours are what keep this from passing against
  // a grid that badges every card or none.
  const badges = page.getByText('Sold out').elements()
  expect(badges).toHaveLength(1)
  expect(badges[0]?.closest('a')?.textContent).toContain('Sport Shorts')
})

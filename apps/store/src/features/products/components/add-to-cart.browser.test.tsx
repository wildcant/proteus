import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryHistory, createRootRoute, createRouter, RouterProvider } from '@tanstack/react-router'
import { useState } from 'react'
import { expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import type { StoreProductResponseProduct, StoreProductScopedOption, StoreProductVariant } from '#/api/generated/model'
import { DEFAULT_MARKET, type MarketContext } from '#/lib/market'
import { AddToCart } from './add-to-cart'
import { VariantPicker } from './variant-picker'

/**
 * The action bar, driven by the pick rather than by a request.
 *
 * Nothing here adds a line item — the sold-out button cannot be pressed and the in-stock one is
 * only ever read — so the cart mutation never leaves the client and no endpoint of ours is faked.
 * What the button does when it *is* pressed belongs in `cart.spec.ts`, against a real backend.
 */

const smallValue = { id: 'optval_small', value: 'S', rank: 0, swatchImageUrl: null }
const mediumValue = { id: 'optval_medium', value: 'M', rank: 1, swatchImageUrl: null }
const largeValue = { id: 'optval_large', value: 'L', rank: 2, swatchImageUrl: null }

const size: StoreProductScopedOption = {
  id: 'opt_size',
  title: 'Size',
  renderAs: 'text',
  values: [smallValue, mediumValue, largeValue],
}

function variant(id: string, valueId: string, stock: StoreProductVariant['stock']): StoreProductVariant {
  return {
    id,
    productId: 'prod_shorts',
    title: 'Sport Shorts',
    thumbnail: null,
    imageIds: [],
    optionValues: { [size.id]: valueId },
    stock,
    sku: null,
    barcode: null,
    material: null,
    weight: null,
    length: null,
    height: null,
    width: null,
    calculatedPrice: { id: 'price_1', currencyCode: 'usd', calculatedAmount: '46.00' },
  }
}

const small = variant('variant_small', smallValue.id, { state: 'soldOut' })
const medium = variant('variant_medium', mediumValue.id, { state: 'available' })
const large = variant('variant_large', largeValue.id, { state: 'low', remaining: 2 })

/**
 * One product — S gone, M on the shelf, L down to its last two — with the targets the API would
 * precompute for it: from S, the variant the shopper landed on, its own value still points at
 * itself, which is what keeps a sold-out variant selectable for someone who navigated straight
 * to it.
 */
const product: StoreProductResponseProduct = {
  id: 'prod_shorts',
  title: 'Sport Shorts',
  handle: 'sport-shorts',
  subtitle: null,
  description: null,
  thumbnail: null,
  weight: null,
  length: null,
  height: null,
  width: null,
  originCountry: null,
  material: null,
  images: [],
  options: [size],
  variants: [small, medium, large],
  pickerTargets: {
    [small.id]: { [smallValue.id]: small.id, [mediumValue.id]: medium.id, [largeValue.id]: large.id },
    [medium.id]: { [smallValue.id]: null, [mediumValue.id]: medium.id, [largeValue.id]: large.id },
    [large.id]: { [smallValue.id]: null, [mediumValue.id]: medium.id, [largeValue.id]: large.id },
  },
}

/**
 * The PDP's own wiring, minus the URL: the page owns which variant is selected and hands it to
 * both the picker and the button, so choosing a size is what the button reacts to.
 */
function Harness() {
  const [variantId, setVariantId] = useState(small.id)
  const selectedVariant = product.variants.find((candidate) => candidate.id === variantId)

  return (
    <>
      <VariantPicker
        options={product.options}
        variants={product.variants}
        pickerTargets={product.pickerTargets}
        selectedVariant={selectedVariant}
        onVariantChange={setVariantId}
      />
      <AddToCart product={product} selectedVariant={selectedVariant} />
    </>
  )
}

/**
 * A memory router for the market and the cart panel's URL state, and a query client for the add
 * mutation. Both are what the button is mounted inside on a real page; neither answers a request
 * in these tests.
 */
function renderHarness() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const market: MarketContext = {
    current: DEFAULT_MARKET,
    markets: [DEFAULT_MARKET],
    defaultMarket: DEFAULT_MARKET,
    resolvedFromUrl: true,
  }
  const router = createRouter({
    routeTree: createRootRoute({ component: Harness }),
    history: createMemoryHistory({ initialEntries: ['/'] }),
    context: { queryClient, market },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      {/* The app's own router type is registered globally; this stub is deliberately not it. */}
      <RouterProvider router={router as never} />
    </QueryClientProvider>,
  )
}

test('a sold-out variant leaves a disabled button that says so', async () => {
  renderHarness()

  // Labelled, not just greyed: a dead "Add to cart" is a button the shopper presses twice before
  // deciding the site is broken, which is the trip to checkout this slice exists to cut short.
  await expect.element(page.getByRole('button', { name: 'Sold out' })).toBeDisabled()
  await expect.element(page.getByRole('button', { name: 'Add to cart' })).not.toBeInTheDocument()
})

test('choosing a size that is in stock brings the button back', async () => {
  renderHarness()

  // The label, not the radio: the control itself is `sr-only`, so the cell is the whole of what a
  // shopper can reach, and clicking it is what the picker's `htmlFor` exists to forward.
  await page.getByText('M', { exact: true }).click()

  await expect.element(page.getByRole('button', { name: 'Add to cart' })).toBeEnabled()
  await expect.element(page.getByRole('button', { name: 'Sold out' })).not.toBeInTheDocument()
})

test('a variant down to its last few is still bought the ordinary way', async () => {
  renderHarness()

  await page.getByText('L', { exact: true }).click()

  // `low` is scarcity, not a refusal. Only `soldOut` closes the button — anything wider would turn
  // the last two units into none, which is the sale this whole slice exists to save.
  await expect.element(page.getByRole('button', { name: 'Add to cart' })).toBeEnabled()
})

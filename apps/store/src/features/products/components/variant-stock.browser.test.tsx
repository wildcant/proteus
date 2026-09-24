import { expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { I18nTestProvider } from '#/lib/i18n/test-i18n'
import { VariantStock } from './variant-stock'

/**
 * The stock line, handed the union and nothing else.
 *
 * Every claim here is which branch draws what, so the answer belongs where it is a value rather
 * than a seeded quantity and a reservation. What the backend puts in each branch — the threshold
 * comparison, the arithmetic behind `remaining`, and untracked and backorder collapsing into
 * `available` — is `product.api.test.ts`, and none of it is repeated here.
 */

test('a low variant says how few are left', async () => {
  render(<VariantStock stock={{ state: 'low', remaining: 3 }} />, { wrapper: I18nTestProvider })

  // The number, not a word for it: "Low stock" is the same sentence for three left and for thirty,
  // and the count is the whole reason the backend put `remaining` on this branch.
  await expect.element(page.getByText('Only 3 left')).toBeVisible()
})

test('a sold-out variant says so on the page, not only on the button', async () => {
  render(<VariantStock stock={{ state: 'soldOut' }} />, { wrapper: I18nTestProvider })

  // The button is pinned to the bottom of a phone's viewport; this line sits with the price, which
  // is where a shopper reading the garment finds out before they reach for the button.
  await expect.element(page.getByText('Sold out')).toBeVisible()
})

test('an available variant draws no stock line at all', async () => {
  const { container } = await render(<VariantStock stock={{ state: 'available' }} />, { wrapper: I18nTestProvider })

  // Not "In stock". A garment that is simply available has nothing to say about its stock, and a
  // line under every price is noise the shopper learns to read past — which is what would cost the
  // other two branches the attention they are rendered for.
  expect(container.textContent).toBe('')
})

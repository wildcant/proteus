import { createMemoryHistory, createRootRoute, createRouter, RouterProvider } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { expect, test, vi } from 'vitest'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import type { StoreSavedMethod } from '#/api/generated/model'
import { PaymentMethodsBookView } from './payment-methods-book-view'

/**
 * The account wallet with its cards as a prop.
 *
 * Everything here is what the page does with an answer — which state it draws, and which card a
 * nomination names — so it belongs where the answer is a value. Reaching these through
 * `usePaymentMethods` would mean faking our own `GET /store/payment-methods`, which is the repair
 * this whole suite exists to undo. What the route itself returns, and in what order, is
 * `payment-method.api.test.ts`.
 *
 * The states asserted below were previously only in the deleted `account-payment-methods.spec.ts`
 * and a wallet that will not load is not reachable e2e at all without stubbing our own API.
 */

const usable = () => ({ expMonth: 12, expYear: new Date().getFullYear() + 3 })

const card = (overrides: Partial<StoreSavedMethod> & Pick<StoreSavedMethod, 'id'>): StoreSavedMethod => ({
  brand: 'visa',
  last4: '4242',
  isDefault: false,
  ...usable(),
  ...overrides,
})

const noop = async () => undefined

/**
 * The page renders `Link`s out to the rest of the account, so it needs a router to be inside.
 *
 * A memory router with this component as its only route: enough for the links to resolve, and no
 * part of the real route tree — a component test that booted the app's router would be asserting
 * through the router's own loaders.
 */
function renderInRouter(ui: ReactNode) {
  const router = createRouter({
    routeTree: createRootRoute({ component: () => <>{ui}</> }),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  // The app's own router type is registered globally; this stub is deliberately not it.
  return render(<RouterProvider router={router as never} />)
}

test('a wallet that will not load is told apart from an empty one, and offers a retry', async () => {
  const onRetry = vi.fn()
  renderInRouter(
    <PaymentMethodsBookView
      methods={[]}
      isLoading={false}
      failed
      onRetry={onRetry}
      onSetDefault={vi.fn()}
      onRemove={noop}
    />,
  )

  // The distinction is the whole point: an empty wallet is a fact about the shopper, a failed read
  // is a fact about us, and answering the second with "No saved cards" sends them off to save a
  // card they already have.
  await expect.element(page.getByRole('alert')).toHaveTextContent("We couldn't load your saved cards.")
  await expect.element(page.getByRole('heading', { name: 'No saved cards' })).not.toBeInTheDocument()

  await page.getByRole('button', { name: 'Try again' }).click()
  expect(onRetry).toHaveBeenCalledOnce()
})

test('choosing a card nominates that card as the default', async () => {
  const onSetDefault = vi.fn()
  renderInRouter(
    <PaymentMethodsBookView
      methods={[card({ id: 'pm_current', last4: '1111', isDefault: true }), card({ id: 'pm_other', last4: '2222' })]}
      isLoading={false}
      failed={false}
      onRetry={vi.fn()}
      onSetDefault={onSetDefault}
      onRemove={noop}
    />,
  )

  // The group's radio means "make this the default" here and "pay with this" at checkout, which is
  // the only thing the two surfaces differ on — so the label is worth reading back.
  await expect.element(page.getByRole('radio', { name: 'Visa ending in 1111, your default card' })).toBeChecked()

  await page.getByRole('radio', { name: 'Make Visa ending in 2222 the default' }).click()

  // By id, not by position: a nomination that reached the wrong card would still move the dot.
  expect(onSetDefault).toHaveBeenCalledWith('pm_other')
})

test('a wallet of nothing but expired cards says what to do about it', async () => {
  renderInRouter(
    <PaymentMethodsBookView
      methods={[card({ id: 'pm_dead', expMonth: 1, expYear: 2020, isDefault: true })]}
      isLoading={false}
      failed={false}
      onRetry={vi.fn()}
      onSetDefault={vi.fn()}
      onRemove={noop}
    />,
  )

  // Not an empty state — the cards are theirs and they should find them — but the page has to say
  // why none of them can be chosen, and the only way to fix it is a purchase.
  await expect
    .element(page.getByText('Every card here has expired. Pay with a new card at checkout to save a usable one.'))
    .toBeVisible()
  await expect.element(page.getByRole('radio', { name: 'Visa ending in 4242, your default card' })).toBeDisabled()
})

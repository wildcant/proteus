import { type ReactNode, useState } from 'react'
import { expect, test, vi } from 'vitest'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { PaymentControllerProvider, usePaymentController } from '#/features/checkout/hooks/use-payment-controller'
import type {
  ConfirmOutcome,
  PaymentAdapterContext,
  SavedMethod,
  StorePaymentAdapter,
} from '#/features/checkout/types/payment'
import { PaymentMethodSelector } from './payment-method-selector'

/**
 * The selector, mounted with an adapter and a wallet rather than a gateway and a round trip.
 *
 * The adapter is the storefront's own client-side port (`types/payment.ts`), so a fake one here is
 * a *prop*, not a stubbed endpoint: `useWallet` is part of the contract the checkout depends on,
 * and what the selector does with the answer is the whole subject. The two claims below both
 * survived only in the deleted `checkout-wallet.spec.ts`, where each needed a browser, a sign-in
 * and a paid-for order to reach a branch that is pure render logic.
 *
 * A real Chromium because a radio's checked state and a disabled control are what is being read.
 */

/** Far enough out that the suite's own clock never makes these stale. */
const usable = () => ({ expMonth: 12, expYear: new Date().getFullYear() + 3 })

const card = (overrides: Partial<SavedMethod> & Pick<SavedMethod, 'id'>): SavedMethod => ({
  brand: 'visa',
  last4: '4242',
  isDefault: false,
  ...usable(),
  ...overrides,
})

const context: PaymentAdapterContext = {
  publicConfig: {},
  amount: '25.00',
  currencyCode: 'usd',
  customer: { id: 'cus_shopper', hasAccount: true },
}

/** Stable across renders: the selector registers it from an effect keyed on its identity. */
const confirm = async (): Promise<ConfirmOutcome> => ({ kind: 'failed', customerMessage: 'not exercised here' })

/** Removal is `saved-card-row.browser.test.tsx`'s subject; nothing below presses it. */
const removeNothing = async () => undefined

type WalletAnswer = ReturnType<NonNullable<StorePaymentAdapter['savedMethods']>['useWallet']>

/**
 * An adapter that draws a recognisable form and nothing else.
 *
 * `useWallet` is called on every render and rebuilds its array, exactly as the real one does when
 * a refetch lands — which is what makes the auto-selection guard below observable at all.
 */
function fakeAdapter(wallet: () => WalletAnswer): StorePaymentAdapter {
  return {
    id: 'fake',
    Root: ({ children }: { children: ReactNode }) => <div data-testid="adapter-root">{children}</div>,
    NewMethodForm: () => <div data-testid="fake-card-form">Card number</div>,
    savedMethods: { useWallet: wallet },
    useConfirm: () => confirm,
  }
}

/** The provider the selector must be inside, plus a way to make it render again. */
function Harness({ adapter }: { adapter: StorePaymentAdapter }) {
  const controller = usePaymentController()
  const [renders, setRenders] = useState(0)

  return (
    <PaymentControllerProvider value={controller}>
      {/* Stands in for a refetch landing: the wallet answers afresh and the tree re-renders. */}
      <button type="button" onClick={() => setRenders(renders + 1)}>
        Refetch the wallet
      </button>
      <PaymentMethodSelector adapter={adapter} context={context} />
    </PaymentControllerProvider>
  )
}

test('a wallet that will not load falls back to the card form with a notice', async () => {
  const refetch = vi.fn(async () => undefined)
  render(
    <Harness
      adapter={fakeAdapter(() => ({ methods: [], isLoading: false, failed: true, refetch, remove: removeNothing }))}
    />,
  )

  // A failed read is not fatal — a shopper who cannot see their saved cards can still pay — so the
  // step is the adapter's form, and the notice is the only thing that distinguishes this from an
  // empty wallet. Answering a failure with silence invites them to save a card they already have.
  await expect.element(page.getByText("We couldn't load your saved cards. Enter a card below to pay.")).toBeVisible()
  await expect.element(page.getByTestId('fake-card-form')).toBeVisible()

  // No rows, and no group either: there is nothing to choose between.
  await expect.element(page.getByRole('radiogroup')).not.toBeInTheDocument()
})

test('auto-selection lands on the default, and a refetch does not move a selection the shopper made', async () => {
  const cards = [card({ id: 'pm_default', last4: '1111', isDefault: true }), card({ id: 'pm_other', last4: '2222' })]
  render(
    <Harness
      adapter={fakeAdapter(() => ({
        // A fresh array each call, as a refetch produces — so the auto-selection effect's
        // dependencies change on every render and the ref guard is the only thing holding it.
        methods: cards.map((method) => ({ ...method })),
        isLoading: false,
        failed: false,
        refetch: async () => undefined,
        remove: removeNothing,
      }))}
    />,
  )

  // The default first, so a returning shopper lands on the card they nominated rather than on
  // whichever row the list happens to start with.
  await expect.element(page.getByRole('radio', { name: 'Pay with Visa ending in 1111' })).toBeChecked()

  await page.getByRole('radio', { name: 'Use a different card' }).click()
  await expect.element(page.getByTestId('fake-card-form')).toBeVisible()

  await page.getByRole('button', { name: 'Refetch the wallet' }).click()

  // The claim: auto-selection happens **once**. Without the guard the effect would run again on
  // the refetch and quietly put the shopper back on their default — with the card they had just
  // started typing left on screen but no longer the thing that would be charged.
  await expect.element(page.getByRole('radio', { name: 'Use a different card' })).toBeChecked()
  await expect.element(page.getByRole('radio', { name: 'Pay with Visa ending in 1111' })).not.toBeChecked()
})

test('an expired default is passed over for the first card the shopper can actually use', async () => {
  const cards = [
    card({ id: 'pm_expired', last4: '1111', isDefault: true, expMonth: 1, expYear: 2020 }),
    card({ id: 'pm_usable', last4: '2222' }),
  ]
  render(
    <Harness
      adapter={fakeAdapter(() => ({
        methods: cards,
        isLoading: false,
        failed: false,
        refetch: async () => undefined,
        remove: removeNothing,
      }))}
    />,
  )

  // A shopper whose default has expired still has a default, and it is not the answer: selecting
  // it would put them on a card the issuer will refuse.
  await expect.element(page.getByRole('radio', { name: 'Pay with Visa ending in 2222' })).toBeChecked()
  await expect.element(page.getByRole('radio', { name: 'Pay with Visa ending in 1111' })).toBeDisabled()
})

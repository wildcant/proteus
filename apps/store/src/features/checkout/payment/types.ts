import type { FC, ReactNode } from 'react'

/**
 * The client half of the payment-provider port, mirroring ADR 0010's server-side one.
 *
 * The checkout knows about adapters and never about a gateway. The contract's central idea is the
 * same opaque-data pattern the backend already uses: the checkout owns the call to our own API and
 * hands the adapter a `createSession` callback; the adapter interprets the provider data blob that
 * comes back and owns the confirmation sequence — because Stripe's and Mercado Pago's sequences
 * genuinely differ and no shared "give me a client secret" abstraction covers both.
 *
 * Validated on paper against Mercado Pago's Payment Brick before it was built:
 * `.scratch/checkout-payment/mercado-pago-port-validation.md`.
 */

/**
 * What the checkout tells an adapter about this purchase. Money stays a major-unit decimal
 * *string* — the shape the API serialises and the rest of the storefront formats — so no float
 * ever represents a total above the adapter. Converting to a gateway's smallest unit happens
 * inside the adapter and nowhere else.
 */
export type PaymentAdapterContext = {
  /** From `GET /store/payment-providers`. Allowlisted, publishable values only. */
  publicConfig: Record<string, unknown>
  /** The cart total as displayed. A display and eligibility input — never what is charged. */
  amount: string
  currencyCode: string
  customer: { id: string; hasAccount: boolean } | null
}

/** A stored card, projected to the same neutral shape whatever gateway holds it. */
export type SavedMethod = {
  id: string
  brand: string
  last4: string
  expMonth: number
  expYear: number
  isDefault: boolean
}

/**
 * What the checkout got back from opening a payment session.
 *
 * `data` is the gateway's own blob, opaque to everything but its adapter. `amount` travels beside
 * it because the server priced the cart itself and the adapter needs that figure to keep the
 * gateway's client SDK in step — Stripe.js refuses a confirmation whose Elements amount disagrees
 * with the intent. The browser never sends an amount; it is only ever told one.
 */
export type PaymentSessionOpened = {
  data: Record<string, unknown>
  /** Major-unit decimal string, priced server-side from the cart. */
  amount: string
  currencyCode: string
}

/** Opens the payment session. Injected, so an adapter can never talk to our API itself. */
export type CreateSession = (providerData?: Record<string, unknown>) => Promise<PaymentSessionOpened>

export type ConfirmArgs = {
  /** `null` means "the new-method form", which is the only case this phase renders. */
  chosenMethodId: string | null
  saveMethod: boolean
  createSession: CreateSession
  /** Where a gateway that leaves the tab must send the shopper back to. */
  returnUrl: string
  /**
   * Contact details the checkout already collected. A gateway that needs them — Stripe's billing
   * details, Mercado Pago's `payerEmail` — is given them rather than asking the shopper twice.
   *
   * Passed per confirmation rather than held on the context, because it is what the shopper typed
   * a moment ago: reading it at render time would send the value from before their last edit.
   */
  contact: { email: string; phone: string | null }
}

/**
 * The terminal answer to "did this shopper pay?", in the checkout's vocabulary rather than a
 * gateway's.
 *
 * `customerMessage` is already sanitised by the adapter that knows the gateway's error
 * vocabulary, so the checkout cannot render a raw gateway string by accident.
 */
export type ConfirmOutcome =
  | { kind: 'succeeded'; reference: string }
  | { kind: 'processing'; reference: string }
  /** The tab is leaving. Render nothing and do not complete the cart. */
  | { kind: 'redirecting' }
  | { kind: 'failed'; customerMessage: string }
  /** The chosen saved method is gone. The wallet refetches and selection resets. */
  | { kind: 'staleMethod' }

export type Confirm = (args: ConfirmArgs) => Promise<ConfirmOutcome>

export type StorePaymentAdapter = {
  /**
   * The provider's identifier — the `stripe` in `pp_stripe_default` — not a full provider id, so
   * one adapter serves every configured instance of that gateway.
   */
  id: string
  /** Wraps the payment step in whatever context the gateway's SDK needs. */
  // biome-ignore lint/style/useNamingConvention: rendered as JSX, so PascalCase is the convention
  Root: FC<{ context: PaymentAdapterContext; children: ReactNode }>
  /** The card entry form. Drawn by the gateway for Stripe; by the Brick for Mercado Pago. */
  // biome-ignore lint/style/useNamingConvention: rendered as JSX, so PascalCase is the convention
  NewMethodForm: FC<{ canSaveMethod: boolean }>
  /**
   * Optional in exactly the way `IPaymentProvider`'s method operations are: a gateway without a
   * wallet needs no stubs. Populated in ILLO-24; absent here and for Mercado Pago's first cut.
   */
  savedMethods?: {
    useList: () => { methods: SavedMethod[]; isLoading: boolean; failed: boolean; refetch: () => void }
    remove: (id: string) => Promise<void>
    setDefault: (id: string) => Promise<void>
  }
  /**
   * Must be called inside `Root`, which is where a gateway's SDK context lives. Returns a stable
   * callback the place-order press awaits.
   */
  useConfirm: () => Confirm
  /**
   * Finishes a confirmation that left the tab, from the query string the gateway returned with.
   *
   * Optional because whether a gateway can redirect at all is a property of the gateway: Stripe's
   * `redirect: 'if_required'` can, Mercado Pago's card flow cannot, and an adapter that never
   * leaves the tab should not have to answer for a return route.
   *
   * Returns `null` while the gateway's SDK is still loading. The distinction matters here and
   * nowhere else: a return page has no shopper to press the button again, so "not yet" must not
   * be answered as "your payment failed".
   */
  useResumeRedirect?: () => ((query: URLSearchParams) => Promise<ConfirmOutcome>) | null
}

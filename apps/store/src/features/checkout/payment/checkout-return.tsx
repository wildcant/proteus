import { Link } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { Button } from '#/components/button'
import { useCart } from '#/features/cart/api/cart'
import { usePaymentProviders } from '../api/checkout'
import { useCompleteOrder } from './complete-order'
import { logPaymentFailure } from './log'
import { resolvePaymentAdapter } from './registry'
import type { ConfirmOutcome, PaymentAdapterContext, StorePaymentAdapter } from './types'

/**
 * Where a redirect payment method lands.
 *
 * `redirect: 'if_required'` splits success in two, and which branch a shopper takes is a property
 * of their country rather than their order — so this path is code that no card in a local test
 * suite reaches unless the suite goes looking for it. It resumes at exactly the step the in-place
 * path resumes at, through the same `useCompleteOrder`, which is what stops the two drifting.
 *
 * Nothing here is written down about money. The gateway is asked what happened, the cart is
 * completed, and the order page is the same one every other shopper lands on.
 */
type CheckoutReturnProps = {
  /** The gateway's own query string, verbatim — only its adapter knows how to read it. */
  query: URLSearchParams
}

export function CheckoutReturn({ query }: CheckoutReturnProps) {
  const providerId = query.get('providerId') ?? ''
  const adapter = resolvePaymentAdapter(providerId)
  const { data, isLoading: isLoadingProviders } = usePaymentProviders()
  const { cart, isLoading: isLoadingCart } = useCart()
  const provider = data?.paymentProviders.find((candidate) => candidate.id === providerId)

  if (isLoadingProviders || isLoadingCart) return <ReturnStatus title="Completing your order…" />

  if (!adapter || !provider || !cart) {
    return (
      <ReturnFailure message="We could not pick your order back up after your payment. If you were charged, nothing has been taken twice — contact us and we will finish it." />
    )
  }

  const context: PaymentAdapterContext = {
    publicConfig: provider.publicConfig,
    amount: cart.totals.cartTotal,
    currencyCode: cart.currencyCode,
    customer: null,
  }

  return (
    <adapter.Root context={context}>
      <ResumeRedirect adapter={adapter} query={query} />
    </adapter.Root>
  )
}

/**
 * Asks the gateway what happened and completes the cart, exactly once.
 *
 * The guard is not decoration: React runs effects twice in development, and a second resume would
 * ask `completeCart` to create a second order for a cart the first call is still completing.
 */
function ResumeRedirect({ adapter, query }: { adapter: StorePaymentAdapter } & CheckoutReturnProps) {
  // `undefined` means this gateway never leaves the tab; `null` means its SDK is still loading.
  const canResume = typeof adapter.useResumeRedirect === 'function'
  const resume = adapter.useResumeRedirect?.() ?? null
  const { completeOrder } = useCompleteOrder()
  const [outcome, setOutcome] = useState<ConfirmOutcome | null>(null)
  const started = useRef(false)

  useEffect(() => {
    if (started.current || !resume) return
    started.current = true

    resume(new URLSearchParams(query))
      .then(async (resolved) => {
        setOutcome(resolved)
        if (resolved.kind === 'succeeded' || resolved.kind === 'processing') await completeOrder()
      })
      .catch((error: unknown) => {
        logPaymentFailure('could not resume after the gateway returned', { error: String(error) })
        setOutcome({ kind: 'failed', customerMessage: 'We could not complete your order. Please try again.' })
      })
  }, [resume, query, completeOrder])

  if (!canResume) {
    return <ReturnFailure message="This payment method cannot be resumed here. Please start the checkout again." />
  }

  if (outcome?.kind === 'failed') return <ReturnFailure message={outcome.customerMessage} />
  if (outcome?.kind === 'staleMethod') {
    return <ReturnFailure message="That saved card is no longer available. Please start the checkout again." />
  }

  return <ReturnStatus title="Completing your order…" />
}

function ReturnStatus({ title }: { title: string }) {
  return (
    <div className="mx-auto w-full max-w-125 px-4 py-16 text-center">
      <h1 className="type-heading m-0 text-ink">{title}</h1>
      <p className="mt-2 text-ink-muted text-sm">Do not close this tab.</p>
    </div>
  )
}

function ReturnFailure({ message }: { message: string }) {
  return (
    <div className="mx-auto w-full max-w-125 px-4 py-16 text-center">
      <h1 className="type-heading m-0 text-ink">Your payment did not finish</h1>
      <p role="alert" className="mt-2 text-ink-muted text-sm">
        {message}
      </p>
      <Button variant="outline" className="mt-6" render={<Link to="/checkout" />}>
        Back to checkout
      </Button>
    </div>
  )
}

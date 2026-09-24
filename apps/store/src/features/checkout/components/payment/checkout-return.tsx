import { Trans, useLingui } from '@lingui/react/macro'
import { useEffect, useRef, useState } from 'react'
import { ButtonLink } from '#/components/button'
import { useCart } from '#/features/cart/api/cart'
import { usePaymentProviders } from '../../api/checkout'
import { useCompleteOrder } from '../../hooks/use-complete-order'
import type { ConfirmOutcome, PaymentAdapterContext, StorePaymentAdapter } from '../../types/payment'
import { logPaymentFailure } from '../../utils/payment/log'
import { resolvePaymentAdapter } from '../../utils/payment/registry'

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
  const { t } = useLingui()
  const providerId = query.get('providerId') ?? ''
  const adapter = resolvePaymentAdapter(providerId)
  const { cart, isLoading: isLoadingCart } = useCart()
  // The provider list is the cart's market's, so it cannot be asked for before the cart is back.
  // `isLoadingCart` covers that gap: a disabled query reports no loading of its own.
  const { data, isLoading: isLoadingProviders } = usePaymentProviders(cart?.id ?? '')
  const provider = data?.paymentProviders.find((candidate) => candidate.id === providerId)

  if (isLoadingProviders || isLoadingCart) return <ReturnStatus title={t`Completing your order…`} />

  if (!adapter || !provider || !cart) {
    return (
      <ReturnFailure
        message={t`We could not pick your order back up after your payment. If you were charged, nothing has been taken twice — contact us and we will finish it.`}
      />
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
  const { t } = useLingui()
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
        setOutcome({ kind: 'failed', customerMessage: t`We could not complete your order. Please try again.` })
      })
  }, [resume, query, completeOrder, t])

  if (!canResume) {
    return <ReturnFailure message={t`This payment method cannot be resumed here. Please start the checkout again.`} />
  }

  if (outcome?.kind === 'failed') return <ReturnFailure message={outcome.customerMessage} />
  if (outcome?.kind === 'staleMethod') {
    return <ReturnFailure message={t`That saved card is no longer available. Please start the checkout again.`} />
  }

  return <ReturnStatus title={t`Completing your order…`} />
}

function ReturnStatus({ title }: { title: string }) {
  return (
    <div className="mx-auto w-full max-w-125 px-4 py-16 text-center">
      <h1 className="type-heading m-0 text-ink">{title}</h1>
      <p className="mt-2 text-ink-muted text-sm">
        <Trans>Do not close this tab.</Trans>
      </p>
    </div>
  )
}

function ReturnFailure({ message }: { message: string }) {
  return (
    <div className="mx-auto w-full max-w-125 px-4 py-16 text-center">
      <h1 className="type-heading m-0 text-ink">
        <Trans>Your payment did not finish</Trans>
      </h1>
      <p role="alert" className="mt-2 text-ink-muted text-sm">
        {message}
      </p>
      <ButtonLink variant="outline" className="mt-6" to="/checkout">
        <Trans>Back to checkout</Trans>
      </ButtonLink>
    </div>
  )
}

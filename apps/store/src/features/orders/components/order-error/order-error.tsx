import { Trans } from '@lingui/react/macro'
import { cn } from '@proteus/ui-core'
import type { ReactNode } from 'react'
import {
  orderError,
  orderErrorActions,
  orderErrorIntro,
  orderErrorMessage,
  orderErrorTitle,
} from '#/features/orders/components/order-error/order-error.variants'

/**
 * The body both order routes render when the read rejects.
 *
 * The copy says the order could not be loaded, not that it does not exist: a 404 and a 500
 * arrive here identically, and guessing between them would be a lie half the time. The number
 * is in the URL, so the message names it — it is the one thing a shopper can quote to support.
 *
 * The way out is a slot rather than a prop, because the two routes differ on it: a guest whose
 * confirmation failed to load has no account to go back to.
 */
export function OrderError({ orderId, children }: { orderId: string; children: ReactNode }) {
  return (
    <main className={cn(orderError(), 'mx-auto w-full max-w-350')}>
      <div className={orderErrorIntro()}>
        <h1 className={orderErrorTitle()}>
          <Trans>We couldn't load this order</Trans>
        </h1>
        <p className={orderErrorMessage()}>
          <Trans>
            Something went wrong loading order <span className="text-ink">{orderId}</span>. Try again in a moment — if
            it keeps happening, quote that number to us.
          </Trans>
        </p>
      </div>
      <div className={orderErrorActions()}>{children}</div>
    </main>
  )
}

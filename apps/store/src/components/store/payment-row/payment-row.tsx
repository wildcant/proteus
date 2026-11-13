import { cn } from '@proteus/ui-core'
import type { VariantProps } from 'class-variance-authority'
import type { ComponentProps } from 'react'
import { paymentRow } from '#/components/store/payment-row/payment-row.variants'

/**
 * The row every payment surface is drawn as — the saved cards in the account wallet, the provider
 * rows in the checkout, and the "use a different card" row that sits among them.
 *
 * It lives in the store's shared layer rather than in either feature because both read it and
 * neither owns it, which is the same reason `#/lib/card-networks` is where it is. Two lists of
 * rows that could disagree about what a row looks like is the seam this exists to close.
 *
 * A third copy lives somewhere no stylesheet of ours can reach: the Payment Element's
 * `.AccordionItem`, written as this row's twin in the Stripe adapter's `appearance.ts`. That is
 * why the drawn geometry is stated in figures the Appearance API can also express: `padding` is
 * settable there and `min-height` is not, so the height is content plus 16px on both.
 */

/**
 * One hairline, collapsed against its neighbour so a stack reads as a single ruled list rather
 * than a column of separate boxes, and focus lifted over every other row's hairline. A row's
 * place in its list is the set's layout, not a property, so these stay here.
 */
const ROW_BEHAVIOUR = 'relative -mt-px first:mt-0 has-[:focus-visible]:z-3'

type PaymentRowState = NonNullable<VariantProps<typeof paymentRow>['state']>

/** The z-index stack per state: which row's border sits over its neighbour's. */
const STATE_BEHAVIOUR: Record<PaymentRowState, string> = {
  default: '',
  /** The radio on this row is on. A full ink border, no layout shift. */
  selected: 'z-2',
  /**
   * This row's *own* surface is open beneath it, so the real choice is made further down.
   *
   * Filled but not bordered, for the same reason the Payment Element's `--selected` accordion
   * state is left unbordered inside an open panel: the list should carry exactly one ink
   * envelope, around the thing being paid with.
   */
  open: 'z-1',
  /** Present but not offering itself — an expired card, or a row mid-confirmation. */
  muted: '',
}

function PaymentRow({ className, state, ...props }: ComponentProps<'div'> & VariantProps<typeof paymentRow>) {
  return (
    <div
      data-slot="payment-row"
      className={cn(paymentRow({ state }), ROW_BEHAVIOUR, STATE_BEHAVIOUR[state ?? 'default'], className)}
      {...props}
    />
  )
}

export { PaymentRow }

import { cn } from '@proteus/ui-core'
import type { ReactNode } from 'react'
import {
  newMethodPanel,
  newMethodPanelConsent,
  newMethodPanelForm,
} from '#/features/checkout/components/new-method-panel/new-method-panel.variants'

/**
 * The opened panel: the gateway's own form, then the consent to keep the card.
 *
 * Always the row above it extended downwards — a fill, an inset, and no top edge, so the row and
 * the panel draw one envelope rather than two stacked boxes. That is also why the Payment
 * Element's `--selected` accordion state is deliberately left unbordered inside here. The overlap
 * onto the row's hairline (`-mt-px`, lifted over it) is the list's layout, as `PaymentRow`'s is.
 *
 * `continuesSelection` is which row it is continuing. The "use a different card" row is the
 * shopper's selection and carries the ink border, so the panel finishes it in ink. In the empty
 * render there is no such row — the panel hangs off the provider row, which is filled rather than
 * bordered — so a hairline is the honest edge for it.
 */
export function NewMethodPanel({
  continuesSelection,
  form,
  consent,
}: {
  continuesSelection: boolean
  /** The gateway's own form. */
  form: ReactNode
  /** `SaveMethodConsent`, when the shopper can keep the card. */
  consent?: ReactNode
}) {
  return (
    <div data-testid="new-method-panel" className={cn(newMethodPanel({ continuesSelection }), 'relative z-1 -mt-px')}>
      <div className={newMethodPanelForm()}>{form}</div>
      {!!consent && <div className={newMethodPanelConsent()}>{consent}</div>}
    </div>
  )
}

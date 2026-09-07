import { cn } from '@proteus/ui'
import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentProps } from 'react'

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
 * why the geometry below is stated in figures the Appearance API can also express.
 */
const paymentRowVariants = cva(
  /**
   * One hairline, collapsed against its neighbour so a stack reads as a single ruled list rather
   * than a column of separate boxes. Every colour is a `@proteus/ui` token — neither this nor the
   * Appearance config writes a colour literal the other also writes.
   *
   * **This side moved to match the gateway's, not the other way round.** The Appearance API decides
   * which properties exist at all: `padding` is settable there and `min-height` is not. A row whose
   * height came from `min-h-15` could therefore never be matched from the other side, so the height
   * is content plus `p-4` on both — 16px, the same figure the Appearance config writes. Hover is the
   * same story in reverse: the gateway's rows filled on hover and ours did not, and a list where
   * half the rows respond to the cursor is the seam AC 9 is about.
   */
  'relative -mt-px flex items-center gap-3 border border-line bg-surface p-4 first:mt-0 hover:bg-surface-subtle has-[:focus-visible]:z-3',
  {
    variants: {
      state: {
        default: '',
        /** The radio on this row is on. A full ink border, no layout shift. */
        selected: 'z-2 border-ink bg-surface-subtle ring-1 ring-ink ring-inset',
        /**
         * This row's *own* surface is open beneath it, so the real choice is made further down.
         *
         * Filled but not bordered, for the same reason the Payment Element's `--selected` accordion
         * state is left unbordered inside an open panel: the list should carry exactly one ink
         * envelope, around the thing being paid with. A provider row and the card row inside it
         * both drawing one stacks two black rectangles and makes the shopper look twice to find
         * their own selection.
         */
        open: 'z-1 bg-surface-subtle',
        /** Present but not offering itself — an expired card, or a row mid-confirmation. */
        muted: 'bg-surface-subtle',
      },
    },
    defaultVariants: {
      state: 'default',
    },
  },
)

/**
 * The label inside a row, exported as variants rather than a component because its consumers wrap
 * `FieldLabel` from `@proteus/ui` and need to pass it `htmlFor`.
 *
 * `has-data-checked:bg-transparent` undoes `FieldLabel`'s own `has-data-checked:bg-primary/5`. The
 * primitive paints a second fill over the *label* whenever it contains a checked control, and a
 * label is narrower than the row that holds it — measured at 430px inside a 500px row, so the
 * selected row's fill stopped 70px short of its own right edge, just before the Remove control. The
 * row already says it is selected. Same class of `FieldLabel` leakage as its `w-fit`.
 */
const paymentRowLabelVariants = cva('flex min-w-0 flex-1 items-center gap-3 has-data-checked:bg-transparent', {
  variants: {
    interactive: {
      true: 'cursor-pointer',
      false: 'cursor-not-allowed',
    },
  },
  defaultVariants: {
    interactive: true,
  },
})

function PaymentRow({ className, state, ...props }: ComponentProps<'div'> & VariantProps<typeof paymentRowVariants>) {
  return <div data-slot="payment-row" className={cn(paymentRowVariants({ state, className }))} {...props} />
}

export { PaymentRow, paymentRowLabelVariants, paymentRowVariants }

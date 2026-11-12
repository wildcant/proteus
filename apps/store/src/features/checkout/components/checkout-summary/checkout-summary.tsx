import { Trans } from '@lingui/react/macro'
import { cn } from '@proteus/ui-core'
import { ChevronDownIcon } from 'lucide-react'
import type { StoreCartDetailResponseCart } from '#/api/generated/model'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '#/components/ui/collapsible/collapsible'
import {
  checkoutSummary,
  checkoutSummaryBody,
  checkoutSummaryChevron,
  checkoutSummaryGlyph,
  checkoutSummaryLabel,
  checkoutSummaryLabelText,
  checkoutSummaryPanel,
  checkoutSummaryPanelInner,
  checkoutSummaryTitle,
  checkoutSummaryTotal,
  checkoutSummaryTrigger,
} from '#/features/checkout/components/checkout-summary/checkout-summary.variants'
import { CheckoutSummaryBody } from '#/features/checkout/components/checkout-summary-body/checkout-summary-body'
import { useFormatters } from '#/hooks/use-formatters'

type CheckoutSummaryProps = {
  cart: StoreCartDetailResponseCart
}

export function CheckoutSummary({ cart, className }: CheckoutSummaryProps & { className?: string }) {
  return (
    <div className={cn(checkoutSummary(), className)}>
      <CheckoutSummaryDisclosure cart={cart} />
      <CheckoutSummaryPanel cart={cart} />
    </div>
  )
}

/**
 * The order as the right half of the page, above `lg`. Not a card: the grey is the pane, and the
 * pane runs to the viewport edge — the form is the workspace and this is the ledger beside it.
 *
 * `hidden lg:flex` against the phone's `lg:hidden` disclosure is the two-tree case `04-footer.md`
 * sanctioned: the switch is pure CSS, so the server renders both and `display: none` keeps the
 * hidden one out of the accessibility tree. A `Collapsible` forced open above `lg` is not
 * something CSS can express.
 */
function CheckoutSummaryPanel({ cart }: CheckoutSummaryProps) {
  return (
    // `h-full` is what makes the sticky child work: left at its auto height the aside is only as
    // tall as the summary itself, so the sticky column has no room inside its containing block to
    // travel and scrolls away with the page. The sticky column and its viewport cap are code.
    <aside className={cn(checkoutSummaryPanel(), 'h-full')}>
      {/* Left-aligned in the right pane, so the column hugs the centre line the split sits on. */}
      <div className={cn(checkoutSummaryPanelInner(), 'sticky top-10 max-h-[calc(100dvh-5rem)]')}>
        <h2 className={cn(checkoutSummaryTitle(), 'm-0 shrink-0')}>
          <Trans>Order summary</Trans>
        </h2>
        <CheckoutSummaryBody cart={cart} className={cn(checkoutSummaryBody(), 'min-h-0 flex-1')} />
      </div>
    </aside>
  )
}

/**
 * The order as a band above the form, below `lg`. Collapsed by default and carrying the total, so
 * the one number a shopper checks before paying is readable without opening anything. The open
 * disclosure is not drawn.
 */
function CheckoutSummaryDisclosure({ cart }: CheckoutSummaryProps) {
  const { formatPrice } = useFormatters()

  return (
    <Collapsible className="lg:hidden">
      <CollapsibleTrigger className={cn(checkoutSummaryTrigger(), 'group w-full cursor-pointer')}>
        <span className={checkoutSummaryLabel()}>
          <span className={checkoutSummaryLabelText()}>
            <Trans>Order summary</Trans>
          </span>
          <ChevronDownIcon
            className={cn(
              checkoutSummaryChevron(),
              checkoutSummaryGlyph(),
              'transition-transform group-aria-expanded:rotate-180',
            )}
          />
        </span>
        <span className={cn(checkoutSummaryTotal(), 'tabular-nums')}>
          {formatPrice(cart.totals.cartTotal, cart.currencyCode)}
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent className="border-line border-b">
        <div className="mx-auto w-full max-w-125 px-4 py-6">
          <CheckoutSummaryBody cart={cart} />
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

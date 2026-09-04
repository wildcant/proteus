import { ShoppingBagIcon } from '@proteus/icons'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@proteus/ui'
import { ChevronDownIcon } from 'lucide-react'
import type { StoreCartDetailResponseCart } from '#/api/generated/model'
import { useFormatters } from '#/lib/use-formatters'

type CheckoutSummaryProps = {
  cart: StoreCartDetailResponseCart
}

export function CheckoutSummary(props: CheckoutSummaryProps) {
  const { cart } = props
  return (
    <div className="bg-surface lg:order-2 lg:bg-surface-subtle">
      <CheckoutSummaryDisclosure cart={cart} />
      <CheckoutSummaryPanel cart={cart} />
    </div>
  )
}

/**
 * The order as the right half of the page, above `lg`. Not a card: the grey is the pane, and the
 * pane runs to the viewport edge — the form is the workspace and this is the ledger beside it.
 *
 * `hidden lg:block` against the phone's `lg:hidden` disclosure is the two-tree case `04-footer.md`
 * sanctioned: the switch is pure CSS, so the server renders both and `display: none` keeps the
 * hidden one out of the accessibility tree. A `Collapsible` forced open above `lg` is not
 * something CSS can express.
 */
function CheckoutSummaryPanel({ cart }: CheckoutSummaryProps) {
  return (
    // `h-full` is what makes the sticky child work. The grid item that stretches to the row is the
    // pane wrapper, not this element — left at its auto height the aside is only as tall as the
    // summary itself, so the sticky div has no room inside its containing block to travel and
    // scrolls away with the page.
    <aside className="hidden h-full px-10 lg:block">
      {/* Left-aligned in the right pane, so the column hugs the centre line the split sits on. */}
      <div className="sticky top-10 flex max-h-[calc(100dvh-5rem)] w-full max-w-100 flex-col py-10">
        <h2 className="type-heading m-0 mb-6 shrink-0 text-ink">Order summary</h2>
        <CheckoutSummaryBody cart={cart} />
      </div>
    </aside>
  )
}

/**
 * The order as a band above the form, below `lg`. Collapsed by default and carrying the total, so
 * the one number a shopper checks before paying is readable without opening anything.
 */
export function CheckoutSummaryDisclosure({ cart }: CheckoutSummaryProps) {
  const { formatPrice } = useFormatters()

  return (
    <Collapsible className="lg:hidden">
      <CollapsibleTrigger className="group flex h-16 w-full cursor-pointer items-center justify-between gap-4 border-line border-b bg-surface-subtle px-4 text-ink">
        <span className="flex items-center gap-2 text-sm">
          Order summary
          <ChevronDownIcon className="size-4 transition-transform group-aria-expanded:rotate-180" />
        </span>
        <span className="font-bold text-sm tabular-nums">{formatPrice(cart.totals.cartTotal, cart.currencyCode)}</span>
      </CollapsibleTrigger>
      <CollapsibleContent className="border-line border-b">
        <div className="mx-auto w-full max-w-125 px-4 py-6">
          <CheckoutSummaryBody cart={cart} />
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

/**
 * The order, as items and totals. Knows nothing about where it is rendered — the desktop panel and
 * the phone disclosure are two trees around this one body, which is what stops them drifting. One
 * scroll region holds the rows *and* the totals, the shape `cart-drawer.tsx` settled on.
 */

function CheckoutSummaryBody({ cart }: CheckoutSummaryProps) {
  const { formatPrice } = useFormatters()

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ul className="m-0 -mt-2 flex min-h-0 flex-1 list-none flex-col gap-4 overflow-y-auto p-0 pt-2">
        {cart.items.map((item) => (
          <li key={item.id} className="flex gap-4">
            <div className="relative shrink-0 self-start">
              <div className="aspect-4/5 w-16 overflow-hidden bg-surface">
                {item.thumbnail ? (
                  <img src={item.thumbnail} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-ink-subtle">
                    <ShoppingBagIcon className="h-4 w-4" />
                  </div>
                )}
              </div>
              <span className="absolute -top-2 -right-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-ink px-1 font-medium text-surface text-xs tabular-nums">
                {item.quantity}
              </span>
            </div>

            <div className="flex min-w-0 flex-1 items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="m-0 text-ink text-sm">{item.title}</p>
                {!!item.variantOptionValues && (
                  <p className="m-0 mt-0.5 text-ink-muted text-xs">{item.variantOptionValues}</p>
                )}
              </div>
              <span className="shrink-0 font-medium text-ink text-sm tabular-nums">
                {formatPrice(item.lineTotal, cart.currencyCode)}
              </span>
            </div>
          </li>
        ))}
      </ul>

      <dl className="m-0 mt-6 flex shrink-0 flex-col gap-3 border-line border-t pt-6">
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-ink-muted text-sm">Subtotal</dt>
          <dd className="m-0 font-medium text-ink text-sm tabular-nums">
            {formatPrice(cart.totals.itemsTotal, cart.currencyCode)}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-ink-muted text-sm">Shipping</dt>
          <dd className="m-0 font-medium text-ink text-sm tabular-nums">
            {cart.shippingMethods.length > 0
              ? formatPrice(cart.totals.shippingTotal, cart.currencyCode)
              : 'Enter shipping address'}
          </dd>
        </div>
        <div className="mt-2 flex items-baseline justify-between gap-4">
          <dt className="font-bold text-base text-ink">Total</dt>
          <dd className="m-0 font-bold text-base text-ink tabular-nums">
            {formatPrice(cart.totals.cartTotal, cart.currencyCode)}
          </dd>
        </div>
      </dl>
    </div>
  )
}

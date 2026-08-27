import { formatPrice } from '@proteus/ui'
import { PackageIcon } from 'lucide-react'
import type { StoreOrderResponseOrder } from '#/api/generated/model'

/**
 * The checkout summary's row, on the record of the checkout that produced it — same 4:5 cover,
 * same badge quantity, same right-aligned line total, so the shopper recognises what they
 * already read twice before paying.
 *
 * Deliberately not the checkout summary's scroll region: that exists because the summary is
 * pinned in a sticky column. This page is a document, and a scroll box inside a scrolling page
 * is two gestures doing one job.
 *
 * A package, not the checkout summary's shopping bag: a bag is the thing you are still carrying.
 */
export function OrderItems({ order }: { order: StoreOrderResponseOrder }) {
  return (
    <ul className="m-0 flex list-none flex-col gap-4 p-0">
      {order.lineItems.map((item) => (
        <li key={item.id} className="flex gap-4">
          <div className="relative shrink-0 self-start">
            <div className="aspect-4/5 w-16 overflow-hidden bg-surface">
              {item.thumbnail ? (
                <img src={item.thumbnail} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-ink-subtle">
                  <PackageIcon className="h-4 w-4" />
                </div>
              )}
            </div>
            <span className="absolute -top-2 -right-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-ink px-1 font-medium text-surface text-xs tabular-nums">
              {item.quantity}
            </span>
          </div>

          <div className="flex min-w-0 flex-1 items-start justify-between gap-4">
            <div className="min-w-0">
              {/* No line-clamp: truncating what someone bought on the record of them buying it
                  is not a trade worth making. */}
              <p className="m-0 text-ink text-sm">{item.title}</p>
              {/* `variantOptionValues` is the same string the cart drawer and the checkout summary
                  showed. `variantTitle` is what orders placed before that column have. */}
              {!!(item.variantOptionValues ?? item.variantTitle) && (
                <p className="m-0 mt-0.5 text-ink-muted text-xs">{item.variantOptionValues ?? item.variantTitle}</p>
              )}
              {/* The arithmetic behind the only number on the row. The checkout summary can leave
                  it out because the shopper is still holding the cart that set it; a receipt read
                  six months later cannot. At one, it is noise. */}
              {item.quantity > 1 && (
                <p className="m-0 mt-0.5 text-ink-muted text-xs tabular-nums">
                  {formatPrice(item.unitPrice, order.currencyCode)} each
                </p>
              )}
            </div>
            <span className="shrink-0 font-medium text-ink text-sm tabular-nums">
              {formatPrice(item.lineTotal, order.currencyCode)}
            </span>
          </div>
        </li>
      ))}
    </ul>
  )
}

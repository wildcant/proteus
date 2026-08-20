import { formatPrice } from '@proteus/ui'
import { PackageIcon } from 'lucide-react'
import type { StoreOrderResponseOrder } from '#/api/generated/model'

export function OrderItems({ order }: { order: StoreOrderResponseOrder }) {
  return (
    <div className="space-y-4">
      {order.lineItems.map((item) => (
        <div key={item.title} className="flex gap-4">
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded bg-(--bg-subtle)">
            {item.thumbnail ? (
              <img src={item.thumbnail} alt={item.title} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-(--foreground-muted)">
                <PackageIcon className="h-5 w-5" />
              </div>
            )}
          </div>
          <div className="flex min-w-0 flex-1 items-start justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">{item.title}</p>
              {item.variantTitle ? (
                <p className="text-sm text-(--foreground-muted)">Variant: {item.variantTitle}</p>
              ) : null}
            </div>
            <div className="text-right">
              <p className="text-sm text-(--foreground-muted)">
                {item.quantity}x {formatPrice(item.unitPrice, order.currencyCode)}
              </p>
              <p className="text-sm font-medium text-foreground">{formatPrice(item.lineTotal, order.currencyCode)}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

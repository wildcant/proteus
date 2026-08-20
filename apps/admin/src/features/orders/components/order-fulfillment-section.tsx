import { Card, CardAction, CardHeader, CardTitle, StatusBadge } from '@proteus/ui'
import type { AdminOrderResponseOrder } from '#/api/generated/model'
import { fulfillmentStatusColors } from '#/features/orders/constants'

export function OrderFulfillmentSection({ order }: { order: AdminOrderResponseOrder }) {
  const shippableItems = order.lineItems.filter((item) => item.requiresShipping)

  if (shippableItems.length === 0) return null

  return (
    <Card className="gap-0 divide-y py-0">
      <CardHeader>
        <CardTitle>Fulfillment</CardTitle>
        <CardAction>
          <StatusBadge color={fulfillmentStatusColors[order.fulfillmentStatus]}>{order.fulfillmentStatus}</StatusBadge>
        </CardAction>
      </CardHeader>

      {shippableItems.map((item) => (
        <div key={item.id} className="flex items-center gap-4 px-6 py-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground text-xs">
            {item.title.charAt(0).toUpperCase()}
          </div>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate font-medium text-sm">{item.title}</span>
            {!!item.variantTitle && <span className="text-muted-foreground text-xs">{item.variantTitle}</span>}
          </div>
          <span className="text-muted-foreground text-sm">&times;{item.quantity}</span>
        </div>
      ))}
    </Card>
  )
}

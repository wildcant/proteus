import { Card, CardHeader, CardTitle, formatPrice } from '@proteus/ui'
import type { AdminOrderResponseOrder } from '#/api/generated/model'

export function OrderSummarySection({ order }: { order: AdminOrderResponseOrder }) {
  const currency = order.currencyCode

  return (
    <Card className="divide-y gap-0 py-0">
      <CardHeader>
        <CardTitle>Summary</CardTitle>
      </CardHeader>

      {order.lineItems.map((item) => (
        <div key={item.id} className="flex items-center gap-4 px-6 py-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-xs text-muted-foreground">
            {item.thumbnail ? (
              <img src={item.thumbnail} alt={item.title} className="size-full rounded-md object-cover" />
            ) : (
              item.title.charAt(0).toUpperCase()
            )}
          </div>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-medium">{item.title}</span>
            {item.variantTitle && (
              <span className="text-xs text-muted-foreground">
                {item.variantTitle}
                {item.variantSku && ` \u00b7 ${item.variantSku}`}
              </span>
            )}
          </div>
          <span className="shrink-0 text-sm text-muted-foreground">{formatPrice(item.unitPrice, currency)}</span>
          <span className="shrink-0 text-sm text-muted-foreground">\u00d7{item.quantity}</span>
          <span className="shrink-0 text-sm font-medium tabular-nums">{formatPrice(item.lineTotal, currency)}</span>
        </div>
      ))}

      <div className="space-y-1 px-6 py-4 text-sm">
        <TotalRow label="Item Subtotal" value={formatPrice(order.totals.itemsTotal, currency)} />
        <TotalRow label="Shipping Subtotal" value={formatPrice(order.totals.shippingTotal, currency)} />
        <TotalRow label="Order Total" value={formatPrice(order.totals.orderTotal, currency)} bold />
      </div>

      <div className="space-y-1 px-6 py-4 text-sm">
        <TotalRow label="Paid Total" value={formatPrice(order.totals.paidTotal, currency)} />
        <TotalRow label="Outstanding amount" value={formatPrice(order.totals.outstandingTotal, currency)} bold />
      </div>
    </Card>
  )
}

function TotalRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={bold ? 'font-medium' : 'tabular-nums'}>{value}</span>
    </div>
  )
}

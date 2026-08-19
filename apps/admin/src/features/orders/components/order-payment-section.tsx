import { Card, CardHeader, CardTitle, formatPrice } from '@proteus/ui'
import { formatDatetime } from '@proteus/utils'
import type { AdminOrderResponseOrder } from '#/api/generated/model'

export function OrderPaymentSection({ order }: { order: AdminOrderResponseOrder }) {
  if (order.transactions.length === 0) return null

  return (
    <Card className="divide-y gap-0 py-0">
      <CardHeader>
        <CardTitle>Transactions</CardTitle>
      </CardHeader>

      {order.transactions.map((transaction) => (
        <div key={transaction.id} className="flex items-center justify-between px-6 py-4 text-sm">
          <div className="flex flex-col">
            <span className="font-medium">{formatPrice(transaction.amount, transaction.currencyCode)}</span>
            <span className="text-xs text-muted-foreground">{formatDatetime(transaction.createdAt)}</span>
          </div>
          {!!transaction.reference && (
            <span className="text-muted-foreground">
              {transaction.reference}
              {!!transaction.referenceId && ` #${transaction.referenceId}`}
            </span>
          )}
        </div>
      ))}

      <div className="flex items-center justify-between px-6 py-4 text-sm">
        <span className="text-muted-foreground">Paid Total</span>
        <span className="font-medium">{formatPrice(order.totals.paidTotal, order.currencyCode)}</span>
      </div>
    </Card>
  )
}

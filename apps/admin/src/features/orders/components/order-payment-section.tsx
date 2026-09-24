import { Trans } from '@lingui/react/macro'
import { Card, CardHeader, CardTitle } from '@proteus/ui'
import { formatDatetime, formatPrice } from '@proteus/utils'
import type { AdminOrderResponseOrder } from '#/api/generated/model'
import { activeLocale, dateLocale } from '#/lib/i18n/locale'

export function OrderPaymentSection({ order }: { order: AdminOrderResponseOrder }) {
  if (order.transactions.length === 0) return null

  return (
    <Card className="gap-0 divide-y py-0">
      <CardHeader>
        <CardTitle>
          <Trans>Transactions</Trans>
        </CardTitle>
      </CardHeader>

      {order.transactions.map((transaction) => (
        <div key={transaction.id} className="flex items-center justify-between px-6 py-4 text-sm">
          <div className="flex flex-col">
            <span className="font-medium">
              {formatPrice(transaction.amount, transaction.currencyCode, activeLocale())}
            </span>
            <span className="text-muted-foreground text-xs">{formatDatetime(transaction.createdAt, dateLocale())}</span>
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
        <span className="text-muted-foreground">
          <Trans>Paid Total</Trans>
        </span>
        <span className="font-medium">{formatPrice(order.totals.paidTotal, order.currencyCode, activeLocale())}</span>
      </div>
    </Card>
  )
}

import { Trans, useLingui } from '@lingui/react/macro'
import { Card, CardHeader, CardTitle } from '@proteus/ui'
import { formatPrice } from '@proteus/utils'
import { Link } from '@tanstack/react-router'
import type { AdminOrderResponseOrder } from '#/api/generated/model'
import { activeLocale } from '#/lib/i18n/locale'

export function OrderSummarySection({ order }: { order: AdminOrderResponseOrder }) {
  const { t } = useLingui()
  const currency = order.currencyCode

  return (
    <Card className="gap-0 divide-y py-0">
      <CardHeader>
        <CardTitle>
          <Trans>Summary</Trans>
        </CardTitle>
      </CardHeader>

      {order.lineItems.map((item) => (
        <div key={item.id} className="flex items-center gap-4 px-6 py-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground text-xs">
            {item.thumbnail ? (
              <img src={item.thumbnail} alt={item.title} className="size-full rounded-md object-cover" />
            ) : (
              item.title.charAt(0).toUpperCase()
            )}
          </div>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate font-medium text-sm">{item.title}</span>
            {!!item.variantTitle && (
              <span className="text-muted-foreground text-xs">
                {item.productId && item.variantId ? (
                  <Link
                    to="/products/$id/variants/$variantId"
                    params={{ id: item.productId, variantId: item.variantId }}
                    className="hover:text-foreground hover:underline"
                  >
                    {item.variantTitle}
                  </Link>
                ) : (
                  item.variantTitle
                )}
                {!!item.variantSku && ` \u00b7 ${item.variantSku}`}
              </span>
            )}
          </div>
          <span className="shrink-0 text-muted-foreground text-sm">
            {formatPrice(item.unitPrice, currency, activeLocale())}
          </span>
          <span className="shrink-0 text-muted-foreground text-sm">\u00d7{item.quantity}</span>
          <span className="shrink-0 font-medium text-sm tabular-nums">
            {formatPrice(item.lineTotal, currency, activeLocale())}
          </span>
        </div>
      ))}

      <div className="space-y-1 px-6 py-4 text-sm">
        <TotalRow label={t`Item Subtotal`} value={formatPrice(order.totals.itemsTotal, currency, activeLocale())} />
        <TotalRow
          label={t`Shipping Subtotal`}
          value={formatPrice(order.totals.shippingTotal, currency, activeLocale())}
        />
        <TotalRow label={t`Order Total`} value={formatPrice(order.totals.orderTotal, currency, activeLocale())} bold />
      </div>

      <div className="space-y-1 px-6 py-4 text-sm">
        <TotalRow label={t`Paid Total`} value={formatPrice(order.totals.paidTotal, currency, activeLocale())} />
        <TotalRow
          label={t`Outstanding amount`}
          value={formatPrice(order.totals.outstandingTotal, currency, activeLocale())}
          bold
        />
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

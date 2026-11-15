import { Trans, useLingui } from '@lingui/react/macro'
import { Card, CardAction, CardHeader, CardTitle, StatusBadge } from '@proteus/ui'
import { formatPrice } from '@proteus/utils'
import { PencilIcon } from 'lucide-react'
import { ActionMenu } from '#/components/common/action-menu'
import type { DraftOrderData } from '#/features/draft-orders/hooks/use-draft-order-data'
import { activeLocale } from '#/lib/i18n/locale'

export function DraftShippingSection({ draftOrder, actions }: DraftOrderData) {
  const { t } = useLingui()

  return (
    <Card className="gap-0 divide-y py-0">
      <CardHeader>
        <CardTitle>
          <Trans>Shipping</Trans>
        </CardTitle>
        {!!actions.canEdit && (
          <CardAction>
            <ActionMenu groups={[{ actions: [{ label: t`Edit`, to: './shipping', icon: <PencilIcon /> }] }]} />
          </CardAction>
        )}
      </CardHeader>

      {draftOrder.shippingMethods.length === 0 && (
        <p className="px-6 py-4 text-muted-foreground text-sm">
          <Trans>No shipping method yet. Set one, at the amount agreed with the shopper if need be.</Trans>
        </p>
      )}

      {draftOrder.shippingMethods.map((method) => (
        <div key={method.id} className="flex items-center gap-4 px-6 py-4 text-sm">
          <span className="min-w-0 flex-1 truncate font-medium">{method.name}</span>
          {!!method.isCustomAmount && (
            <StatusBadge color="blue">
              <Trans>custom amount</Trans>
            </StatusBadge>
          )}
          <span className="shrink-0 tabular-nums">
            {formatPrice(method.amount, draftOrder.currencyCode, activeLocale())}
          </span>
        </div>
      ))}
    </Card>
  )
}

import { useLingui } from '@lingui/react/macro'
import { Card, CardAction, CardHeader, CardTitle, StatusBadge, usePrompt } from '@proteus/ui'
import { formatDatetime } from '@proteus/utils'
import { ArchiveIcon, CheckCircleIcon, XCircleIcon } from 'lucide-react'
import type { AdminOrderResponseOrder } from '#/api/generated/model'
import { ActionMenu } from '#/components/common/action-menu'
import { useArchiveOrder, useCancelOrder, useCompleteOrder } from '#/features/orders/api/orders'
import {
  fulfillmentStatusColors,
  fulfillmentStatusLabels,
  orderStatusColors,
  orderStatusLabels,
} from '#/features/orders/utils/order-status'
import { useUiCopy } from '#/hooks/use-ui-copy'
import { dateLocale } from '#/lib/i18n/locale'

export function OrderGeneralSection({ order }: { order: AdminOrderResponseOrder }) {
  const { mutateAsync: complete } = useCompleteOrder(order.id)
  const { mutateAsync: cancel } = useCancelOrder(order.id)
  const { mutateAsync: archive } = useArchiveOrder(order.id)
  const prompt = usePrompt()
  const { t, i18n } = useLingui()
  const { cancel: cancelText } = useUiCopy()

  const handleComplete = async () => {
    const confirmed = await prompt({
      title: t`Complete order`,
      description: t`Are you sure you want to mark this order as completed?`,
      confirmText: t`Complete`,
      cancelText,
    })
    if (confirmed) {
      await complete()
    }
  }

  const handleCancel = async () => {
    const confirmed = await prompt({
      title: t`Cancel order`,
      description: t`Are you sure you want to cancel this order? This will release all inventory reservations.`,
      confirmText: t`Cancel order`,
      cancelText,
      variant: 'danger',
    })
    if (confirmed) {
      await cancel()
    }
  }

  const handleArchive = async () => {
    const confirmed = await prompt({
      title: t`Archive order`,
      description: t`Are you sure you want to archive this order?`,
      confirmText: t`Archive`,
      cancelText,
    })
    if (confirmed) {
      await archive()
    }
  }

  const { canComplete, canCancel, canArchive } = order.allowedActions

  const actions = [
    ...(canComplete ? [{ label: t`Complete`, onClick: handleComplete, icon: <CheckCircleIcon /> }] : []),
    ...(canCancel ? [{ label: t`Cancel`, onClick: handleCancel, icon: <XCircleIcon /> }] : []),
    ...(canArchive ? [{ label: t`Archive`, onClick: handleArchive, icon: <ArchiveIcon /> }] : []),
  ]

  return (
    <Card className="gap-0 divide-y py-0">
      <CardHeader>
        <div>
          <CardTitle>#{order.displayId}</CardTitle>
          <p className="text-muted-foreground text-sm">{formatDatetime(order.createdAt, dateLocale())}</p>
        </div>
        <CardAction className="flex items-center gap-x-3">
          <StatusBadge color={orderStatusColors[order.status]}>{i18n._(orderStatusLabels[order.status])}</StatusBadge>
          <StatusBadge color={fulfillmentStatusColors[order.fulfillmentStatus]}>
            {i18n._(fulfillmentStatusLabels[order.fulfillmentStatus])}
          </StatusBadge>
          {actions.length > 0 && <ActionMenu groups={[{ actions }]} />}
        </CardAction>
      </CardHeader>
    </Card>
  )
}

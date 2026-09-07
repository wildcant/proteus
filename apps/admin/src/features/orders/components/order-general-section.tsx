import { Card, CardAction, CardHeader, CardTitle, StatusBadge, usePrompt } from '@proteus/ui'
import { formatDatetime } from '@proteus/utils'
import { ArchiveIcon, CheckCircleIcon, XCircleIcon } from 'lucide-react'
import type { AdminOrderResponseOrder } from '#/api/generated/model'
import { ActionMenu } from '#/components/common/action-menu'
import { useArchiveOrder, useCancelOrder, useCompleteOrder } from '#/features/orders/api/orders'
import { fulfillmentStatusColors, orderStatusColors } from '#/features/orders/utils/order-status'

export function OrderGeneralSection({ order }: { order: AdminOrderResponseOrder }) {
  const { mutateAsync: complete } = useCompleteOrder(order.id)
  const { mutateAsync: cancel } = useCancelOrder(order.id)
  const { mutateAsync: archive } = useArchiveOrder(order.id)
  const prompt = usePrompt()

  const handleComplete = async () => {
    const confirmed = await prompt({
      title: 'Complete order',
      description: 'Are you sure you want to mark this order as completed?',
      confirmText: 'Complete',
    })
    if (confirmed) {
      await complete()
    }
  }

  const handleCancel = async () => {
    const confirmed = await prompt({
      title: 'Cancel order',
      description: 'Are you sure you want to cancel this order? This will release all inventory reservations.',
      confirmText: 'Cancel order',
      variant: 'danger',
    })
    if (confirmed) {
      await cancel()
    }
  }

  const handleArchive = async () => {
    const confirmed = await prompt({
      title: 'Archive order',
      description: 'Are you sure you want to archive this order?',
      confirmText: 'Archive',
    })
    if (confirmed) {
      await archive()
    }
  }

  const { canComplete, canCancel, canArchive } = order.allowedActions

  const actions = [
    ...(canComplete ? [{ label: 'Complete', onClick: handleComplete, icon: <CheckCircleIcon /> }] : []),
    ...(canCancel ? [{ label: 'Cancel', onClick: handleCancel, icon: <XCircleIcon /> }] : []),
    ...(canArchive ? [{ label: 'Archive', onClick: handleArchive, icon: <ArchiveIcon /> }] : []),
  ]

  return (
    <Card className="gap-0 divide-y py-0">
      <CardHeader>
        <div>
          <CardTitle>#{order.displayId}</CardTitle>
          <p className="text-muted-foreground text-sm">{formatDatetime(order.createdAt)}</p>
        </div>
        <CardAction className="flex items-center gap-x-3">
          <StatusBadge color={orderStatusColors[order.status]}>{order.status}</StatusBadge>
          <StatusBadge color={fulfillmentStatusColors[order.fulfillmentStatus]}>{order.fulfillmentStatus}</StatusBadge>
          {actions.length > 0 && <ActionMenu groups={[{ actions }]} />}
        </CardAction>
      </CardHeader>
    </Card>
  )
}

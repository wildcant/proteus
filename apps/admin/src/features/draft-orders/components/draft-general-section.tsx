import { useLingui } from '@lingui/react/macro'
import { Card, CardAction, CardHeader, CardTitle, StatusBadge, usePrompt } from '@proteus/ui'
import { formatDatetime } from '@proteus/utils'
import { useNavigate } from '@tanstack/react-router'
import { ArrowRightCircleIcon, TrashIcon, XCircleIcon } from 'lucide-react'
import { ActionMenu } from '#/components/common/action-menu'
import { useCancelDraftOrder, useDeleteDraftOrder } from '#/features/draft-orders/api/draft-orders'
import type { DraftOrderData } from '#/features/draft-orders/hooks/use-draft-order-data'
import { orderStatusColors, orderStatusLabels } from '#/features/orders/utils/order-status'
import { useUiCopy } from '#/hooks/use-ui-copy'
import { dateLocale } from '#/lib/i18n/locale'

export function DraftGeneralSection({ draftOrder, actions }: DraftOrderData) {
  const { t, i18n } = useLingui()
  const { cancel: cancelText } = useUiCopy()
  const prompt = usePrompt()
  const navigate = useNavigate()
  const { mutateAsync: cancelDraft } = useCancelDraftOrder(draftOrder.id)
  const { mutateAsync: deleteDraft } = useDeleteDraftOrder(draftOrder.id)
  const reference = draftOrder.reference

  const handleCancel = async () => {
    const confirmed = await prompt({
      title: t`Cancel draft order`,
      description: t`Cancel ${reference}? The shopper's order link will show it canceled, and it can no longer be edited or converted.`,
      confirmText: t`Cancel draft`,
      cancelText,
      variant: 'danger',
    })
    if (confirmed) await cancelDraft()
  }

  const handleDelete = async () => {
    const confirmed = await prompt({
      title: t`Delete draft order`,
      description: t`Delete ${reference}? It leaves the drafts list for good.`,
      confirmText: t`Delete`,
      cancelText,
      variant: 'danger',
    })
    if (confirmed) await deleteDraft(undefined, { onSuccess: () => navigate({ to: '/draft-orders' }) })
  }

  const menu = [
    {
      actions: actions.canConvert
        ? [{ label: t`Convert to order`, to: './convert', icon: <ArrowRightCircleIcon /> }]
        : [],
    },
    {
      actions: [
        ...(actions.canCancel ? [{ label: t`Cancel`, onClick: handleCancel, icon: <XCircleIcon /> }] : []),
        ...(actions.canDelete ? [{ label: t`Delete`, onClick: handleDelete, icon: <TrashIcon /> }] : []),
      ],
    },
  ]
  // An empty group would still draw its separator.
  const groups = menu.filter((group) => group.actions.length > 0)

  return (
    <Card className="gap-0 divide-y py-0">
      <CardHeader>
        <div>
          <CardTitle>{reference}</CardTitle>
          <p className="text-muted-foreground text-sm">{formatDatetime(draftOrder.createdAt, dateLocale())}</p>
        </div>
        <CardAction className="flex items-center gap-x-3">
          <StatusBadge color={orderStatusColors[draftOrder.status]}>
            {i18n._(orderStatusLabels[draftOrder.status])}
          </StatusBadge>
          {groups.length > 0 && <ActionMenu groups={groups} />}
        </CardAction>
      </CardHeader>
    </Card>
  )
}

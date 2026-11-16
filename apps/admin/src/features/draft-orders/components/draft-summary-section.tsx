import { Trans, useLingui } from '@lingui/react/macro'
import { Button, Card, CardAction, CardHeader, CardTitle, usePrompt } from '@proteus/ui'
import { formatPrice } from '@proteus/utils'
import { MinusIcon, PlusIcon, TrashIcon } from 'lucide-react'
import type { AdminOrderLineItem } from '#/api/generated/model'
import { ActionMenu } from '#/components/common/action-menu'
import { useRemoveDraftOrderItem, useUpdateDraftOrderItem } from '#/features/draft-orders/api/draft-orders'
import type { DraftOrderData } from '#/features/draft-orders/hooks/use-draft-order-data'
import { LineItemTotal } from '#/features/orders/components/line-item-total'
import { useUiCopy } from '#/hooks/use-ui-copy'
import { activeLocale } from '#/lib/i18n/locale'

export function DraftSummarySection({ draftOrder, actions }: DraftOrderData) {
  const { t } = useLingui()
  const currency = draftOrder.currencyCode
  const { totals } = draftOrder

  return (
    <Card className="gap-0 divide-y py-0">
      <CardHeader>
        <CardTitle>
          <Trans>Summary</Trans>
        </CardTitle>
        {!!actions.canEdit && (
          <CardAction>
            <ActionMenu groups={[{ actions: [{ label: t`Add item`, to: './add-item', icon: <PlusIcon /> }] }]} />
          </CardAction>
        )}
      </CardHeader>

      {draftOrder.lineItems.length === 0 && (
        <p className="px-6 py-4 text-muted-foreground text-sm">
          <Trans>This draft has no items.</Trans>
        </p>
      )}

      {draftOrder.lineItems.map((item) => (
        <DraftItemRow
          key={item.id}
          draftOrderId={draftOrder.id}
          item={item}
          currency={currency}
          canEdit={actions.canEdit}
        />
      ))}

      <div className="space-y-1 px-6 py-4 text-sm">
        <TotalRow label={t`Item Subtotal`} value={formatPrice(totals.itemsTotal, currency, activeLocale())} />
        <TotalRow label={t`Shipping Subtotal`} value={formatPrice(totals.shippingTotal, currency, activeLocale())} />
        <TotalRow label={t`Order Total`} value={formatPrice(totals.orderTotal, currency, activeLocale())} bold />
      </div>
    </Card>
  )
}

type DraftItemRowProps = {
  draftOrderId: string
  item: AdminOrderLineItem
  currency: string
  canEdit: boolean
}

/** Quantity and removal write on the click: each is one choice, not a form to fill in. */
function DraftItemRow({ draftOrderId, item, currency, canEdit }: DraftItemRowProps) {
  const { t } = useLingui()
  const { cancel } = useUiCopy()
  const prompt = usePrompt()
  const updateItem = useUpdateDraftOrderItem(draftOrderId, item.id)
  const removeItem = useRemoveDraftOrderItem(draftOrderId, item.id)
  const isWriting = updateItem.isPending || removeItem.isPending
  const title = item.title
  const options = item.variantOptions.map((option) => `${option.optionTitle}: ${option.value}`).join(' · ')

  const handleRemove = async () => {
    const confirmed = await prompt({
      title: t`Remove item`,
      description: t`Remove "${title}" from this draft?`,
      confirmText: t`Remove`,
      cancelText: cancel,
      variant: 'danger',
    })
    if (confirmed) removeItem.mutate()
  }

  return (
    <div className="flex items-center gap-4 px-6 py-4">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground text-xs">
        {item.thumbnail ? (
          <img src={item.thumbnail} alt={item.title} className="size-full rounded-md object-cover" />
        ) : (
          item.title.charAt(0).toUpperCase()
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-medium text-sm">{item.title}</span>
        {!!(options || item.variantSku) && (
          <span className="text-muted-foreground text-xs">
            {options || item.variantTitle}
            {!!item.variantSku && ` · ${item.variantSku}`}
          </span>
        )}
      </div>
      <span className="shrink-0 text-muted-foreground text-sm">
        {formatPrice(item.unitPrice, currency, activeLocale())}
      </span>
      {canEdit ? (
        <div className="flex shrink-0 items-center gap-x-1">
          <Button
            variant="outline"
            size="icon-xs"
            aria-label={t`Decrease quantity`}
            disabled={isWriting || item.quantity <= 1}
            onClick={() => updateItem.mutate({ quantity: item.quantity - 1 })}
          >
            <MinusIcon />
          </Button>
          <span className="w-6 text-center text-sm tabular-nums">{item.quantity}</span>
          <Button
            variant="outline"
            size="icon-xs"
            aria-label={t`Increase quantity`}
            disabled={isWriting}
            onClick={() => updateItem.mutate({ quantity: item.quantity + 1 })}
          >
            <PlusIcon />
          </Button>
        </div>
      ) : (
        <span className="shrink-0 text-muted-foreground text-sm">{`×${item.quantity}`}</span>
      )}
      <LineItemTotal item={item} currency={currency} />
      {!!canEdit && (
        <Button variant="ghost" size="icon-xs" aria-label={t`Remove item`} disabled={isWriting} onClick={handleRemove}>
          <TrashIcon />
        </Button>
      )}
    </div>
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

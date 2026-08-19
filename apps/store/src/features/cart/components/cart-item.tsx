import { formatPrice, NativeSelect, NativeSelectOption } from '@proteus/ui'
import { Loader2Icon, ShoppingBagIcon, TrashIcon } from 'lucide-react'
import type { StoreCartLineItem } from '#/api/generated/model'
import { Button } from '#/components/button'
import { useRemoveLineItem, useUpdateLineItem } from '#/features/cart/api/cart'

export function CartItem({ item, currencyCode }: { item: StoreCartLineItem; currencyCode: string }) {
  const updateLineItem = useUpdateLineItem()
  const removeLineItem = useRemoveLineItem()

  const isMutating = updateLineItem.isPending || removeLineItem.isPending

  return (
    <div className="flex gap-4 border-b border-(--border) pb-4">
      <div className="h-20 w-20 shrink-0 overflow-hidden bg-(--bg-subtle)">
        {item.thumbnail ? (
          <img src={item.thumbnail} alt={item.title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-(--foreground-muted)">
            <ShoppingBagIcon className="h-6 w-6" />
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-between">
        <div>
          <h3 className="font-medium text-(--foreground)">{item.title}</h3>
          {item.variantTitle && <p className="text-sm text-(--foreground-muted)">{item.variantTitle}</p>}
        </div>

        <div className="flex items-center gap-3">
          <p className="text-sm text-(--foreground-muted)">{formatPrice(item.unitPrice, currencyCode)} each</p>
        </div>
      </div>

      <div className="flex flex-col items-end justify-between">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => removeLineItem.mutate(item.id)}
          disabled={isMutating}
          aria-label={`Remove ${item.title}`}
        >
          {removeLineItem.isPending ? <Loader2Icon className="animate-spin" /> : <TrashIcon />}
        </Button>

        <div className="flex items-center gap-3">
          <NativeSelect
            value={item.quantity}
            onChange={(event) => updateLineItem.mutate({ lineId: item.id, quantity: Number(event.target.value) })}
            disabled={isMutating}
            size="sm"
            aria-label={`Quantity for ${item.title}`}
          >
            {Array.from({ length: 10 }, (_, index) => index + 1).map((number) => (
              <NativeSelectOption key={number} value={number}>
                {number}
              </NativeSelectOption>
            ))}
          </NativeSelect>

          <span className="min-w-[5rem] text-right font-semibold text-(--foreground)">
            {formatPrice(item.lineTotal, currencyCode)}
          </span>
        </div>
      </div>
    </div>
  )
}

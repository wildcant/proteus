import { formatPrice } from '@proteus/ui'
import { Link } from '@tanstack/react-router'
import { ShoppingBagIcon } from 'lucide-react'
import type { StoreCartLineItem } from '#/api/generated/model'
import { QuantityStepper } from '#/features/cart/components/quantity-stepper'
import { useLineItemQuantity } from '#/features/cart/hooks/use-line-item-quantity'

/** The ceiling the PDP already enforces, restated here so the panel cannot exceed it. */
const MAX_QUANTITY = 10

/**
 * One row of the cart panel. Not `CartItem`'s successor by accident: everything runs at the
 * storefront's 14px body, because the row is a line of the bag, not a product card.
 */
export function CartItem({ item, currencyCode }: { item: StoreCartLineItem; currencyCode: string }) {
  // Not disabled while saving — the hook holds the value and debounces, so taps land on the click.
  // Removing still blocks, because the row is on its way out.
  const { quantity, setQuantity, remove, isRemoving } = useLineItemQuantity(item)

  return (
    <li className="flex gap-3">
      {/* `self-start` is load-bearing: the row's default `stretch` overrides `aspect-ratio` and
          was cropping every thumbnail to 1:1.42 instead of 4:5. */}
      <div className="aspect-4/5 w-17 shrink-0 self-start overflow-hidden bg-surface-subtle">
        {item.thumbnail ? (
          <img src={item.thumbnail} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-ink-subtle">
            <ShoppingBagIcon className="h-4 w-4" />
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* productId, not a handle: the PDP route is `/products/$productId`. */}
        {item.productId ? (
          <Link to="/products/$productId" params={{ productId: item.productId }} className="text-ink text-sm">
            {item.title}
          </Link>
        ) : (
          <p className="m-0 text-ink text-sm">{item.title}</p>
        )}

        {/* Subtle, not muted — muted is the summary's label tier, and one grey doing both jobs
            stops the row separating name from spec. */}
        {item.variantOptionValues ? (
          <p className="m-0 mt-0.5 text-ink-subtle text-sm">{item.variantOptionValues}</p>
        ) : null}

        {/* `mt-auto`, not `justify-between`: stretching to the thumbnail left a gap mid-row. */}
        <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-3">
          <span className="font-bold text-ink text-sm">{formatPrice(item.unitPrice, currencyCode)}</span>

          <QuantityStepper
            size="xs"
            variant="bare"
            label={item.title}
            value={quantity}
            min={1}
            max={MAX_QUANTITY}
            disabled={isRemoving}
            isRemoving={isRemoving}
            onChange={setQuantity}
            onRemove={remove}
          />
        </div>
      </div>
    </li>
  )
}

import { cn } from '@proteus/ui-core'
import { Link } from '@tanstack/react-router'
import type { StoreCartLineItem } from '#/api/generated/model'
import { Icon } from '#/components/ui/icon/icon'
import { QuantityStepper } from '#/components/ui/quantity-stepper/quantity-stepper'
import {
  cartItem,
  cartItemDetails,
  cartItemFooter,
  cartItemImage,
  cartItemInfo,
  cartItemOptions,
  cartItemPrice,
  cartItemQuantity,
  cartItemThumbnail,
  cartItemTitle,
} from '#/features/cart/components/cart-item/cart-item.variants'
import { useLineItemQuantity } from '#/features/cart/hooks/use-line-item-quantity'
import { useFormatters } from '#/hooks/use-formatters'
import type { LinkTarget } from '#/lib/link-target'

/** The ceiling the PDP already enforces, restated here so the panel cannot exceed it. */
const MAX_QUANTITY = 10

/**
 * One row of the cart panel. Not `CartItem`'s successor by accident: everything runs at the
 * storefront's 14px body, because the row is a line of the bag, not a product card.
 */
export function CartItem({
  item,
  currencyCode,
  productLink,
  className,
}: {
  item: StoreCartLineItem
  currencyCode: string
  /** PRODUCT: the line's product page. */
  productLink: (productId: string) => LinkTarget
  className?: string
}) {
  // Not disabled while saving — the hook holds the value and debounces, so taps land on the click.
  // Removing still blocks, because the row is on its way out.
  const { quantity, setQuantity, remove, isRemoving } = useLineItemQuantity(item)
  const { formatPrice } = useFormatters()

  return (
    <li className={cn(cartItem(), className)}>
      {/* `self-start` is load-bearing: a `stretch` row overrides `aspect-ratio` and crops every
          thumbnail to 1:1.42 instead of 4:5. */}
      <div className={cn(cartItemThumbnail(), 'aspect-4/5 shrink-0 self-start')}>
        {item.thumbnail ? (
          <img src={item.thumbnail} alt="" className={cn(cartItemImage(), 'h-full w-full object-cover')} />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-ink-subtle">
            <Icon name="shopping-bag" className="h-4 w-4" />
          </div>
        )}
      </div>

      <div className={cn(cartItemInfo(), 'min-w-0')}>
        <div className={cartItemDetails()}>
          {/* productId, not a handle: the product page is addressed by id. */}
          {item.productId ? (
            <Link {...productLink(item.productId)} className={cartItemTitle()}>
              {item.title}
            </Link>
          ) : (
            <p className={cn(cartItemTitle(), 'm-0')}>{item.title}</p>
          )}

          {/* Subtle, not muted — muted is the summary's label tier, and one grey doing both jobs
              stops the row separating name from spec. */}
          {item.variantOptionValues ? <p className={cn(cartItemOptions(), 'm-0')}>{item.variantOptionValues}</p> : null}
        </div>

        <div className={cartItemFooter()}>
          <span className={cartItemPrice()}>{formatPrice(item.unitPrice, currencyCode)}</span>

          <QuantityStepper
            size="xs"
            label={item.title}
            value={quantity}
            min={1}
            max={MAX_QUANTITY}
            disabled={isRemoving}
            isRemoving={isRemoving}
            onChange={setQuantity}
            onRemove={remove}
            className={cartItemQuantity()}
          />
        </div>
      </div>
    </li>
  )
}

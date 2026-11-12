import { Trans } from '@lingui/react/macro'
import { cn } from '@proteus/ui-core'
import { useNavigate } from '@tanstack/react-router'
import { Loader2Icon } from 'lucide-react'
import { useState } from 'react'
import type { StoreProductResponseProduct, StoreProductVariant } from '#/api/generated/model'
import { Button } from '#/components/ui/button/button'
import { QuantityStepper } from '#/components/ui/quantity-stepper/quantity-stepper'
import { useAddLineItem } from '#/entities/cart/api/cart'
import {
  addToCart,
  addToCartAdd,
  addToCartQuantity,
} from '#/features/products/components/add-to-cart/add-to-cart.variants'
import type { LinkTarget } from '#/lib/link-target'

const MAX_QUANTITY = 10

type AddToCartProps = {
  product: StoreProductResponseProduct
  /** Owned by the product page: the gallery and the picker react to it too, so it lives in the URL. */
  selectedVariant: StoreProductVariant | undefined
  /** ADD_TO_BAG: the bag, open over this page. */
  bagLink: LinkTarget
  className?: string
}

export function AddToCart({ product, selectedVariant, bagLink, className }: AddToCartProps) {
  const [quantity, setQuantity] = useState(1)
  const addLineItem = useAddLineItem()
  const navigate = useNavigate()

  const handleAddToCart = () => {
    if (!selectedVariant) return

    // Only the pick travels. The title, the option values and the price the line is written at
    // are the catalogue's to state, and `add-to-cart` reads them server-side — a browser that
    // could name its own price would be naming the terms of the sale.
    addLineItem.mutate(
      { variantId: selectedVariant.id, quantity },
      {
        // The panel is the confirmation. A toast saying "Added to cart" on top of a panel that
        // just slid in showing the item is the same message twice. Opening from the mutation
        // rather than from a watched item count means a background refetch cannot pop it open.
        onSuccess: () => navigate(bagLink),
      },
    )
  }

  if (product.variants.length === 0) {
    return (
      <p className="text-ink-muted text-sm">
        <Trans>This product isn't available to order yet.</Trans>
      </p>
    )
  }

  // A render of `soldOut`, not a field beside it. The backend already collapsed untracked,
  // backorder and in-stock into `available`, so there is no second question to ask here — and no
  // second answer that could drift out of step with the one the picker strikes values through on.
  const isSoldOut = selectedVariant?.stock.state === 'soldOut'

  return (
    // Pinned to the phone viewport from first paint rather than revealed once the inline button
    // scrolls away: this is the page's entire job, and the reveal pattern costs a scroll observer
    // to take the primary action off the first screen. `z-40` sits under the header's `z-50` —
    // they are at opposite edges, and a bar outranking a sticky header is a bug waiting for a
    // short viewport. The page's own gutters are restated here because `fixed` escapes them.
    <div className={cn(addToCart(), 'fixed inset-x-0 bottom-4 z-40 lg:static lg:z-auto', className)}>
      <QuantityStepper
        label={product.title}
        value={quantity}
        onChange={setQuantity}
        min={1}
        max={MAX_QUANTITY}
        size="lg"
        className={addToCartQuantity()}
      />

      {/* Relabelled as well as disabled: a dead "Add to cart" is a button a shopper presses twice
          before deciding the site is broken, which is the trip to checkout this replaces. */}
      <Button
        className={addToCartAdd()}
        disabled={addLineItem.isPending || !selectedVariant || isSoldOut}
        onClick={handleAddToCart}
      >
        {addLineItem.isPending ? <Loader2Icon className="mr-2 size-4 animate-spin" /> : null}
        {isSoldOut ? <Trans>Sold out</Trans> : <Trans>Add to cart</Trans>}
      </Button>
    </div>
  )
}

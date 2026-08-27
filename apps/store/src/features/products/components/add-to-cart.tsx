import { Loader2Icon } from 'lucide-react'
import { useState } from 'react'
import type { StoreProductResponseProduct, StoreProductVariant } from '#/api/generated/model'
import { Button } from '#/components/button'
import { useAddLineItem } from '#/features/cart/api/cart'
import { QuantityStepper } from '#/features/cart/components/quantity-stepper'
import { useModal } from '#/lib/modal-state'

const MAX_QUANTITY = 10

type AddToCartProps = {
  product: StoreProductResponseProduct
  /** Owned by the product page: the gallery and the picker react to it too, so it lives in the URL. */
  selectedVariant: StoreProductVariant | undefined
}

export function AddToCart({ product, selectedVariant }: AddToCartProps) {
  const [quantity, setQuantity] = useState(1)
  const addLineItem = useAddLineItem()
  const { setOpen: setCartOpen } = useModal('cart')

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
        onSuccess: () => setCartOpen(true),
      },
    )
  }

  if (product.variants.length === 0) {
    return <p className="text-ink-muted text-sm">This product isn't available to order yet.</p>
  }

  return (
    // Pinned to the phone viewport from first paint rather than revealed once the inline button
    // scrolls away: this is the page's entire job, and the reveal pattern costs a scroll observer
    // to take the primary action off the first screen. `z-40` sits under the header's `z-50` —
    // they are at opposite edges, and a bar outranking a sticky header is a bug waiting for a
    // short viewport. The page's own gutters are restated here because `fixed` escapes them.
    <div className="fixed inset-x-0 bottom-4 z-40 flex gap-2 px-4 sm:px-6 lg:static lg:z-auto lg:px-0">
      <QuantityStepper
        label={product.title}
        value={quantity}
        onChange={setQuantity}
        min={1}
        max={MAX_QUANTITY}
        size="lg"
      />

      <Button className="flex-1" disabled={addLineItem.isPending || !selectedVariant} onClick={handleAddToCart}>
        {addLineItem.isPending ? <Loader2Icon className="mr-2 size-4 animate-spin" /> : null}
        Add to cart
      </Button>
    </div>
  )
}

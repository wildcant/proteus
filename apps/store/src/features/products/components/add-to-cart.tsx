import { Loader2Icon } from 'lucide-react'
import { useState } from 'react'
import type { StoreProductResponseProduct, StoreProductScopedOption, StoreProductVariant } from '#/api/generated/model'
import { Button } from '#/components/button'
import { useAddLineItem } from '#/features/cart/api/cart'
import { QuantityStepper } from '#/features/cart/components/quantity-stepper'
import { useModal } from '#/lib/modal-state'

const MAX_QUANTITY = 10

/**
 * The variant's chosen values as one display string, e.g. `S · Blue`.
 *
 * `variant.optionValues` maps option id to option *value* id, not to the value itself, so the
 * ids have to be resolved against the product's options to become words. Driven by `options`
 * rather than by the map's own key order, because that is what puts Size before Colour — the
 * product's option rank is the order the picker uses, and the cart line should read the same way.
 */
function formatVariantOptions(options: StoreProductScopedOption[], variant: StoreProductVariant) {
  return options
    .map((option) => option.values.find((value) => value.id === variant.optionValues[option.id])?.value)
    .filter((value) => value !== undefined)
    .join(' · ')
}

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

    addLineItem.mutate(
      {
        title: product.title,
        unitPrice: selectedVariant.calculatedPrice.calculatedAmount,
        quantity,
        variantId: selectedVariant.id,
        productId: product.id,
        productTitle: product.title,
        variantSku: selectedVariant.sku ?? undefined,
        variantTitle: selectedVariant.title,
        // Values only, no option names: they are redundant next to a thumbnail of the thing, and
        // this is the string the cart prints verbatim. Empty for a product with no options, which
        // is left off the payload rather than written as a blank.
        variantOptionValues: formatVariantOptions(product.options, selectedVariant) || undefined,
      },
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
    <div className="flex flex-col gap-4">
      <div className="flex gap-3">
        <QuantityStepper label={product.title} value={quantity} onChange={setQuantity} min={1} max={MAX_QUANTITY} />

        <Button className="h-11 flex-1" disabled={addLineItem.isPending || !selectedVariant} onClick={handleAddToCart}>
          {addLineItem.isPending ? <Loader2Icon className="mr-2 h-4 w-4 animate-spin" /> : null}
          Add to cart
        </Button>
      </div>
    </div>
  )
}

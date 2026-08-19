import { Button, NativeSelect, NativeSelectOption, toast } from '@proteus/ui'
import { Loader2Icon } from 'lucide-react'
import { useState } from 'react'
import type { StoreProductResponseProduct } from '#/api/generated/model'
import { useAddLineItem } from '#/features/cart/api/cart'

type AddToCartProps = {
  product: StoreProductResponseProduct
}

export function AddToCart({ product }: AddToCartProps) {
  const [selectedVariantId, setSelectedVariantId] = useState(product.variants[0]?.id ?? '')
  const [quantity, setQuantity] = useState(1)
  const addLineItem = useAddLineItem()

  const selectedVariant = product.variants.find((variant) => variant.id === selectedVariantId)

  const handleAddToCart = () => {
    if (!selectedVariant) return

    addLineItem.mutate(
      {
        title: product.title,
        unitPrice: selectedVariant.calculatedPrice.originalAmount,
        quantity,
        variantId: selectedVariant.id,
        productId: product.id,
        productTitle: product.title,
        variantSku: selectedVariant.sku ?? undefined,
      },
      {
        onSuccess: () => {
          toast.add({ type: 'success', title: 'Added to cart' })
        },
      },
    )
  }

  if (product.variants.length === 0) return null

  return (
    <div className="mt-8 space-y-4">
      {product.variants.length > 1 && (
        <div>
          <label htmlFor="variant-select" className="mb-1.5 block text-sm font-medium text-(--sea-ink)">
            Variant
          </label>
          <NativeSelect
            id="variant-select"
            className="w-full"
            value={selectedVariantId}
            onChange={(event) => setSelectedVariantId(event.target.value)}
          >
            {product.variants.map((variant) => (
              <NativeSelectOption key={variant.id} value={variant.id}>
                {variant.title}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      )}

      <div>
        <label htmlFor="quantity-input" className="mb-1.5 block text-sm font-medium text-(--sea-ink)">
          Quantity
        </label>
        <NativeSelect
          id="quantity-input"
          className="w-full"
          value={quantity}
          onChange={(event) => setQuantity(Number(event.target.value))}
        >
          {Array.from({ length: 10 }, (_, index) => index + 1).map((number) => (
            <NativeSelectOption key={number} value={number}>
              {number}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>

      <Button className="w-full" disabled={addLineItem.isPending || !selectedVariant} onClick={handleAddToCart}>
        {addLineItem.isPending ? <Loader2Icon className="mr-2 h-4 w-4 animate-spin" /> : null}
        Add to cart
      </Button>
    </div>
  )
}

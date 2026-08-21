import { NativeSelect, NativeSelectOption, toast } from '@proteus/ui'
import { Loader2Icon, MinusIcon, PlusIcon } from 'lucide-react'
import { useState } from 'react'
import type { StoreProductResponseProduct, StoreProductVariant } from '#/api/generated/model'
import { Button } from '#/components/button'
import { useAddLineItem } from '#/features/cart/api/cart'

const MAX_QUANTITY = 10

type AddToCartProps = {
  product: StoreProductResponseProduct
  /** Owned by the product page: the gallery reacts to it too, so it lives in the URL. */
  selectedVariant: StoreProductVariant | undefined
  onVariantChange: (variantId: string) => void
}

export function AddToCart({ product, selectedVariant, onVariantChange }: AddToCartProps) {
  const [quantity, setQuantity] = useState(1)
  const addLineItem = useAddLineItem()

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
      },
      {
        onSuccess: () => {
          toast.add({ type: 'success', title: 'Added to cart' })
        },
      },
    )
  }

  if (product.variants.length === 0) {
    return <p className="text-(--foreground-muted) text-sm">This product isn't available to order yet.</p>
  }

  return (
    <div className="flex flex-col gap-4">
      {product.variants.length > 1 && (
        <div>
          <label
            htmlFor="variant-select"
            className="mb-2 block text-foreground-muted text-xs uppercase tracking-[0.18em]"
          >
            Variant
          </label>
          <NativeSelect
            id="variant-select"
            className="w-full rounded-none"
            value={selectedVariant?.id ?? ''}
            onChange={(event) => onVariantChange(event.target.value)}
          >
            {product.variants.map((variant) => (
              <NativeSelectOption key={variant.id} value={variant.id}>
                {variant.title}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      )}

      <div className="flex gap-3">
        <div className="flex items-stretch border border-border">
          <QuantityButton
            label="Decrease quantity"
            disabled={quantity <= 1}
            onClick={() => setQuantity((current) => current - 1)}
          >
            <MinusIcon className="h-3.5 w-3.5" />
          </QuantityButton>
          <output className="flex w-9 items-center justify-center text-foreground text-sm tabular-nums">
            {quantity}
          </output>
          <QuantityButton
            label="Increase quantity"
            disabled={quantity >= MAX_QUANTITY}
            onClick={() => setQuantity((current) => current + 1)}
          >
            <PlusIcon className="h-3.5 w-3.5" />
          </QuantityButton>
        </div>

        <Button className="h-11 flex-1" disabled={addLineItem.isPending || !selectedVariant} onClick={handleAddToCart}>
          {addLineItem.isPending ? <Loader2Icon className="mr-2 h-4 w-4 animate-spin" /> : null}
          Add to cart
        </Button>
      </div>
    </div>
  )
}

type QuantityButtonProps = {
  label: string
  disabled: boolean
  onClick: () => void
  children: React.ReactNode
}

function QuantityButton({ label, disabled, onClick, children }: QuantityButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex w-9 items-center justify-center text-foreground -outline-offset-2 hover:bg-(--bg-subtle) focus-visible:outline focus-visible:outline-foreground disabled:opacity-30 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  )
}

import { cn, NativeSelect, NativeSelectOption } from '@proteus/ui'
import type { StoreProductImage, StoreProductOption, StoreProductVariant } from '#/api/generated/model'
import { buildVariantPicker, canRenderPicker, type PickerValue } from '#/features/products/variant-picker'

type VariantPickerProps = {
  options: StoreProductOption[]
  variants: StoreProductVariant[]
  images: StoreProductImage[]
  selectedVariant: StoreProductVariant | undefined
  onVariantChange: (variantId: string) => void
}

/**
 * Option pickers driven by the variant/option-value link. Products whose variants carry no option
 * values — anything created before the link existed — fall back to a plain list of variant titles,
 * so the page never degrades to an empty picker.
 */
export function VariantPicker({ options, variants, images, selectedVariant, onVariantChange }: VariantPickerProps) {
  if (!canRenderPicker(options, variants)) {
    return <VariantSelect variants={variants} selectedVariant={selectedVariant} onVariantChange={onVariantChange} />
  }

  const rows = buildVariantPicker({ options, variants, selectedVariant })
  const imageUrlById = new Map(images.map((image) => [image.id, image.url]))

  return (
    <div className="flex flex-col gap-5">
      {rows.map((row) => (
        <fieldset key={row.id} className="border-0 p-0">
          <legend className="mb-2 block text-foreground-muted text-xs uppercase tracking-[0.18em]">
            {row.title}
            {row.renderAs === 'swatch' && !!selectedVariant && (
              <span className="ml-2 text-foreground normal-case tracking-normal">
                {row.values.find((value) => value.isSelected)?.value}
              </span>
            )}
          </legend>
          <div className="flex flex-wrap gap-2">
            {row.values.map((value) =>
              row.renderAs === 'swatch' ? (
                <SwatchValue
                  key={value.id}
                  value={value}
                  imageUrl={value.swatchImageId ? imageUrlById.get(value.swatchImageId) : undefined}
                  onSelect={onVariantChange}
                />
              ) : (
                <TextValue key={value.id} value={value} onSelect={onVariantChange} />
              ),
            )}
          </div>
        </fieldset>
      ))}
    </div>
  )
}

type ValueProps = {
  value: PickerValue
  onSelect: (variantId: string) => void
}

function TextValue({ value, onSelect }: ValueProps) {
  return (
    <button
      type="button"
      aria-pressed={value.isSelected}
      disabled={!value.isAvailable}
      onClick={() => value.targetVariantId && onSelect(value.targetVariantId)}
      className={cn(
        'min-w-11 border px-3 py-2 text-sm -outline-offset-2 transition-colors focus-visible:outline focus-visible:outline-foreground',
        value.isSelected ? 'border-foreground bg-foreground text-background' : 'border-border text-foreground',
        !value.isSelected && value.isAvailable && 'hover:border-foreground',
        // Struck through rather than merely dimmed, so "sold out" reads differently from "muted".
        !value.isAvailable && 'cursor-not-allowed text-foreground-muted line-through opacity-50',
      )}
    >
      {value.value}
    </button>
  )
}

function SwatchValue({ value, imageUrl, onSelect }: ValueProps & { imageUrl: string | undefined }) {
  return (
    <button
      type="button"
      aria-label={value.value}
      aria-pressed={value.isSelected}
      disabled={!value.isAvailable}
      onClick={() => value.targetVariantId && onSelect(value.targetVariantId)}
      className={cn(
        'size-11 overflow-hidden rounded-full border-2 -outline-offset-2 transition-colors focus-visible:outline focus-visible:outline-foreground',
        value.isSelected ? 'border-foreground' : 'border-transparent',
        !value.isAvailable && 'cursor-not-allowed opacity-40',
      )}
    >
      {imageUrl ? (
        <img src={imageUrl} alt="" className="size-full object-cover" />
      ) : (
        <span className="flex size-full items-center justify-center bg-(--bg-subtle) text-[10px] text-foreground-muted uppercase">
          {value.value.slice(0, 2)}
        </span>
      )}
    </button>
  )
}

type VariantSelectProps = {
  variants: StoreProductVariant[]
  selectedVariant: StoreProductVariant | undefined
  onVariantChange: (variantId: string) => void
}

/** The pre-options fallback. Kept keyed on variant id and labelled "Variant" for existing callers. */
function VariantSelect({ variants, selectedVariant, onVariantChange }: VariantSelectProps) {
  if (variants.length <= 1) return null

  return (
    <div>
      <label htmlFor="variant-select" className="mb-2 block text-foreground-muted text-xs uppercase tracking-[0.18em]">
        Variant
      </label>
      <NativeSelect
        id="variant-select"
        className="w-full rounded-none"
        value={selectedVariant?.id ?? ''}
        onChange={(event) => onVariantChange(event.target.value)}
      >
        {variants.map((variant) => (
          <NativeSelectOption key={variant.id} value={variant.id}>
            {variant.title}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  )
}

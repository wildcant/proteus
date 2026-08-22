import { cn, NativeSelect, NativeSelectOption } from '@proteus/ui'
import type { StoreProductScopedOption, StoreProductVariant } from '#/api/generated/model'

type PickerTargets = Record<string, Record<string, string | null>>

type VariantPickerProps = {
  options: StoreProductScopedOption[]
  variants: StoreProductVariant[]
  /** Where every option value leads, per variant the shopper could be on. Precomputed by the API. */
  pickerTargets: PickerTargets
  selectedVariant: StoreProductVariant | undefined
  onVariantChange: (variantId: string) => void
}

/**
 * Option pickers driven by the variant/option-value link.
 *
 * The selection rules — which values are reachable, which variant a click lands on, which image a
 * swatch shows — are all resolved server-side, so this only renders. Products whose variants carry
 * no option values fall back to a plain list of variant titles, so the page never degrades to an
 * empty picker.
 */
export function VariantPicker({
  options,
  variants,
  pickerTargets,
  selectedVariant,
  onVariantChange,
}: VariantPickerProps) {
  const targets = selectedVariant ? pickerTargets[selectedVariant.id] : undefined

  if (options.length === 0 || !selectedVariant || !targets) {
    return <VariantSelect variants={variants} selectedVariant={selectedVariant} onVariantChange={onVariantChange} />
  }

  return (
    <div className="flex flex-col gap-5">
      {options.map((option) => (
        <fieldset key={option.id} className="border-0 p-0">
          <legend className="mb-2 block text-foreground-muted text-xs uppercase tracking-[0.18em]">
            {option.title}
            {option.renderAs === 'swatch' && (
              <span className="ml-2 text-foreground normal-case tracking-normal">
                {option.values.find((value) => targets[value.id] === selectedVariant.id)?.value}
              </span>
            )}
          </legend>
          <div className="flex flex-wrap gap-2">
            {option.values.map((value) => {
              // A value pointing at the variant you are on is how "selected" is expressed; a null
              // target means no purchasable variant carries it alongside the current selection.
              const target = targets[value.id] ?? null
              const props = {
                label: value.value,
                isSelected: target === selectedVariant.id,
                isAvailable: target !== null,
                onSelect: () => target && onVariantChange(target),
              }
              return option.renderAs === 'swatch' ? (
                <SwatchValue key={value.id} {...props} imageUrl={value.swatchImageUrl} />
              ) : (
                <TextValue key={value.id} {...props} />
              )
            })}
          </div>
        </fieldset>
      ))}
    </div>
  )
}

type ValueProps = {
  label: string
  isSelected: boolean
  isAvailable: boolean
  onSelect: () => void
}

function TextValue({ label, isSelected, isAvailable, onSelect }: ValueProps) {
  return (
    <button
      type="button"
      aria-pressed={isSelected}
      disabled={!isAvailable}
      onClick={onSelect}
      className={cn(
        'min-w-11 border px-3 py-2 text-sm -outline-offset-2 transition-colors focus-visible:outline focus-visible:outline-foreground',
        isSelected ? 'border-foreground bg-foreground text-background' : 'border-border text-foreground',
        !isSelected && isAvailable && 'hover:border-foreground',
        // Struck through rather than merely dimmed, so "sold out" reads differently from "muted".
        !isAvailable && 'cursor-not-allowed text-foreground-muted line-through opacity-50',
      )}
    >
      {label}
    </button>
  )
}

function SwatchValue({ label, isSelected, isAvailable, onSelect, imageUrl }: ValueProps & { imageUrl: string | null }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={isSelected}
      disabled={!isAvailable}
      onClick={onSelect}
      className={cn(
        'size-11 overflow-hidden rounded-full border-2 -outline-offset-2 transition-colors focus-visible:outline focus-visible:outline-foreground',
        isSelected ? 'border-foreground' : 'border-transparent',
        !isAvailable && 'cursor-not-allowed opacity-40',
      )}
    >
      {imageUrl ? (
        <img src={imageUrl} alt="" className="size-full object-cover" />
      ) : (
        <span className="flex size-full items-center justify-center bg-(--bg-subtle) text-[10px] text-foreground-muted uppercase">
          {label.slice(0, 2)}
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

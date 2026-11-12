import { Trans } from '@lingui/react/macro'
import { cn } from '@proteus/ui-core'
import type { StoreProductScopedOption, StoreProductVariant } from '#/api/generated/model'
import { NativeSelect, NativeSelectOption } from '#/components/ui/native-select/native-select'
import { SwatchValue } from '#/features/products/components/swatch-value/swatch-value'
import { TextValue } from '#/features/products/components/text-value/text-value'
import {
  variantPicker,
  variantPickerCell,
  variantPickerCells,
  variantPickerSelectedValue,
  variantPickerSwatch,
  variantPickerSwatches,
  variantPickerSwatchOption,
  variantPickerSwatchOptionLegend,
  variantPickerTextOption,
  variantPickerTextOptionLegend,
} from '#/features/products/components/variant-picker/variant-picker.variants'

type PickerTargets = Record<string, Record<string, string | null>>

type VariantPickerProps = {
  options: StoreProductScopedOption[]
  variants: StoreProductVariant[]
  /** Where every option value leads, per variant the shopper could be on. Precomputed by the API. */
  pickerTargets: PickerTargets
  selectedVariant: StoreProductVariant | undefined
  onVariantChange: (variantId: string) => void
  /** The pickers' place in the caller's layout; the fallback select keeps its own. */
  className?: string
}

/**
 * Option pickers driven by the variant/option-value link.
 *
 * The selection rules — which values are reachable, which variant a click lands on, which image a
 * swatch shows — are all resolved server-side, so this only renders. Products whose variants carry
 * no option values fall back to a plain list of variant titles, so the page never degrades to an
 * empty picker.
 *
 * Each option is one native radio group. A toggle button per value would give every value its own
 * tab stop and announce seven independent pressed/unpressed controls rather than one choice of
 * seven; sharing `name={option.id}` is what makes the browser hand back roving focus, arrow-key
 * traversal and `disabled` skipping for free.
 */
export function VariantPicker({
  options,
  variants,
  pickerTargets,
  selectedVariant,
  onVariantChange,
  className,
}: VariantPickerProps) {
  const targets = selectedVariant ? pickerTargets[selectedVariant.id] : undefined

  if (options.length === 0 || !selectedVariant || !targets) {
    return <VariantSelect variants={variants} selectedVariant={selectedVariant} onVariantChange={onVariantChange} />
  }

  return (
    <div className={cn(variantPicker(), className)}>
      {options.map((option) => {
        const selectedValue = option.values.find((value) => targets[value.id] === selectedVariant.id)
        const isSwatch = option.renderAs === 'swatch'

        return (
          <fieldset
            key={option.id}
            className={cn(isSwatch ? variantPickerSwatchOption() : variantPickerTextOption(), 'border-0 p-0')}
          >
            {/* The value is not in here. A legend carrying the current selection changes the
                group's accessible name on every click; the name belongs under the strip. `mb-2`
                because a legend sits outside its fieldset's flex flow, so the set's gap misses it. */}
            <legend
              className={cn(
                isSwatch ? variantPickerSwatchOptionLegend() : variantPickerTextOptionLegend(),
                'mb-2 block',
              )}
            >
              {option.title}
            </legend>

            <div className={isSwatch ? variantPickerSwatches() : variantPickerCells()}>
              {option.values.map((value) => {
                // A value pointing at the variant you are on is how "selected" is expressed; a null
                // target means no purchasable variant carries it alongside the current selection.
                const target = targets[value.id] ?? null
                const props = {
                  id: value.id,
                  name: option.id,
                  label: value.value,
                  isSelected: target === selectedVariant.id,
                  isAvailable: target !== null,
                  onSelect: () => target && onVariantChange(target),
                }
                return isSwatch ? (
                  <SwatchValue
                    key={value.id}
                    {...props}
                    imageUrl={value.swatchImageUrl}
                    className={variantPickerSwatch()}
                  />
                ) : (
                  <TextValue key={value.id} {...props} className={variantPickerCell()} />
                )
              })}
            </div>

            {isSwatch && !!selectedValue && <p className={variantPickerSelectedValue()}>{selectedValue.value}</p>}
          </fieldset>
        )
      })}
    </div>
  )
}

type VariantSelectProps = {
  variants: StoreProductVariant[]
  selectedVariant: StoreProductVariant | undefined
  onVariantChange: (variantId: string) => void
}

/**
 * The pre-options fallback. Kept keyed on variant id and labelled "Variant" for existing callers.
 * Not drawn yet (every seeded product has options), so its look stays here.
 */
function VariantSelect({ variants, selectedVariant, onVariantChange }: VariantSelectProps) {
  if (variants.length <= 1) return null

  return (
    <div>
      <label htmlFor="variant-select" className="mb-2 block text-ink-muted text-xs">
        <Trans>Variant</Trans>
      </label>
      <NativeSelect
        id="variant-select"
        wrapperClassName="w-full"
        className="rounded-none"
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

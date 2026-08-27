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
}: VariantPickerProps) {
  const targets = selectedVariant ? pickerTargets[selectedVariant.id] : undefined

  if (options.length === 0 || !selectedVariant || !targets) {
    return <VariantSelect variants={variants} selectedVariant={selectedVariant} onVariantChange={onVariantChange} />
  }

  return (
    <div className="flex flex-col gap-6">
      {options.map((option) => {
        const selectedValue = option.values.find((value) => targets[value.id] === selectedVariant.id)

        return (
          <fieldset key={option.id} className="border-0 p-0">
            {/* The value is not in here. A legend carrying the current selection changes the
                group's accessible name on every click; the name belongs under the strip. */}
            <legend className="mb-2 block text-ink">{option.title}</legend>

            <div className={option.renderAs === 'swatch' ? 'flex flex-wrap gap-2' : 'grid grid-cols-4'}>
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
                return option.renderAs === 'swatch' ? (
                  <SwatchValue key={value.id} {...props} imageUrl={value.swatchImageUrl} />
                ) : (
                  <TextValue key={value.id} {...props} />
                )
              })}
            </div>

            {option.renderAs === 'swatch' && !!selectedValue && (
              <p className="mt-2 text-ink-subtle text-xs">{selectedValue.value}</p>
            )}
          </fieldset>
        )
      })}
    </div>
  )
}

type ValueProps = {
  /** The option value's own id — unique per product, so it is safe as a DOM id. */
  id: string
  /** Shared across one option's values, which is the only thing that makes them one group. */
  name: string
  label: string
  isSelected: boolean
  isAvailable: boolean
  onSelect: () => void
}

/**
 * The visually-hidden control.
 *
 * `sr-only` rather than a transparent overlay: `htmlFor` already makes the label a real pointer
 * target that forwards its clicks to the radio, so covering the cell buys nothing and costs the
 * label its own `:hover` — an input painted on top owns the pointer, which forces every hover rule
 * through `peer-hover` and leaves the cursor on a control nobody can see.
 *
 * It comes first and carries `peer` so the label — its next sibling — can react to it: hiding the
 * input hides the platform's own focus ring, and painting that back is the one part of a native
 * radio that does not come free. Same mechanism `components/form/input.tsx` uses for its floating
 * label.
 */
function ValueInput({
  id,
  name,
  isSelected,
  isAvailable,
  onSelect,
  ariaLabel,
}: Omit<ValueProps, 'label'> & { ariaLabel?: string }) {
  return (
    <input
      id={id}
      type="radio"
      name={name}
      className="peer sr-only"
      checked={isSelected}
      disabled={!isAvailable}
      onChange={onSelect}
      aria-label={ariaLabel}
    />
  )
}

/**
 * A size cell.
 *
 * The grid runs at zero gap on purpose: the 1px borders meet and the values read as one table
 * rather than as four loose buttons. Four columns at every width — the label is 12px, which is what
 * lets a seven-size run hold four columns on a 390px phone.
 */
function TextValue(props: ValueProps) {
  const { id, label, isSelected, isAvailable } = props

  return (
    <div className="relative">
      <ValueInput {...props} />
      <label
        htmlFor={id}
        className={cn(
          'flex h-13 cursor-pointer items-end justify-start border border-line px-2 py-1 text-xs uppercase transition-colors peer-focus-visible:outline peer-focus-visible:outline-ink peer-focus-visible:-outline-offset-2 peer-disabled:cursor-not-allowed',
          isSelected && 'border-ink bg-ink font-bold text-surface',
          !isSelected && isAvailable && 'hover:border-ink',
          // Struck through rather than merely dimmed, so "sold out" reads differently from "muted".
          // Never-offered collapses into the same treatment: the response cannot tell them apart.
          !isAvailable && 'text-ink-muted line-through',
        )}
      >
        {label}
      </label>
    </div>
  )
}

/**
 * A colourway tile.
 *
 * 4:5 rather than a disc: `swatchImageUrl` is a photograph of the garment, and a 44px circle crops
 * it to an average colour the catalogue does not actually store. The border is 2px in both states
 * so nothing shifts when the selection moves.
 */
function SwatchValue(props: ValueProps & { imageUrl: string | null }) {
  const { id, label, isSelected, isAvailable, imageUrl } = props

  return (
    <div className="relative w-12">
      <ValueInput {...props} ariaLabel={label} />
      <label
        htmlFor={id}
        className={cn(
          'block cursor-pointer overflow-hidden border-2 transition-colors peer-focus-visible:outline peer-focus-visible:outline-ink peer-focus-visible:-outline-offset-2 peer-disabled:cursor-not-allowed',
          isSelected ? 'border-ink' : 'border-transparent',
          !isAvailable && 'opacity-40',
        )}
      >
        {imageUrl ? (
          <img src={imageUrl} alt="" className="aspect-4/5 w-full object-cover" />
        ) : (
          <span className="flex aspect-4/5 w-full items-center justify-center bg-surface-subtle text-[10px] text-ink-muted uppercase">
            {label.slice(0, 2)}
          </span>
        )}
      </label>
    </div>
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
      <label htmlFor="variant-select" className="mb-2 block text-ink-muted text-xs">
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

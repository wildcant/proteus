import type { StoreProductOption, StoreProductVariant } from '#/api/generated/model'

export type PickerValue = {
  id: string
  value: string
  isSelected: boolean
  /** False when no buyable variant carries this value alongside the options above it. */
  isAvailable: boolean
  /** The variant to select when this value is picked. Undefined exactly when unavailable. */
  targetVariantId: string | undefined
  /** First image of the first variant carrying this value, for swatch rendering. */
  swatchImageId: string | undefined
}

export type PickerRow = {
  id: string
  title: string
  renderAs: StoreProductOption['renderAs']
  values: PickerValue[]
}

/**
 * Turns the product's options and variants into rows the picker can render directly.
 *
 * Options are resolved **left to right**: a value on option *k* is available when some buyable
 * variant carries it alongside the current selection for options `0..k-1`. Picking it keeps that
 * prefix and re-resolves the options after it. The first option is therefore always fully open,
 * which is what keeps every combination reachable — evaluating each option against *all* the
 * others instead dead-ends. Given only `S/Blue` and `M/Black`, sitting on `M/Black` would grey out
 * both `S` and `Blue` and leave the shopper stuck.
 *
 * A variant is buyable when it is in the response at all (the API drops variants with no price)
 * and `inStock`. So the picker never offers a combination that cannot be bought.
 */
export function buildVariantPicker({
  options,
  variants,
  selectedVariant,
}: {
  options: StoreProductOption[]
  variants: StoreProductVariant[]
  selectedVariant: StoreProductVariant | undefined
}): PickerRow[] {
  const buyable = variants.filter((variant) => variant.inStock)

  // An option the selection says nothing about does not constrain — which covers both "nothing
  // selected yet" and a variant whose tuple is incomplete.
  const matchesPrefix = (variant: StoreProductVariant, upToIndex: number) =>
    options.slice(0, upToIndex).every((option) => {
      const selected = selectedVariant?.optionValues[option.id]
      return selected === undefined || variant.optionValues[option.id] === selected
    })

  return options.map((option, index) => {
    const reachable = buyable.filter((variant) => matchesPrefix(variant, index))

    const values = option.values.map((value) => {
      const target = reachable.find((variant) => variant.optionValues[option.id] === value.id)
      // The swatch shows the colourway even when it is currently unavailable, so this looks at
      // every variant rather than only the reachable ones.
      const carrier = variants.find((variant) => variant.optionValues[option.id] === value.id)

      return {
        id: value.id,
        value: value.value,
        isSelected: selectedVariant?.optionValues[option.id] === value.id,
        isAvailable: target !== undefined,
        targetVariantId: target?.id,
        swatchImageId: carrier?.imageIds[0],
      }
    })

    return { id: option.id, title: option.title, renderAs: option.renderAs, values }
  })
}

/**
 * Whether the picker can drive this product at all. Data created before variants carried option
 * values has options but no tuples, and would render a picker where nothing is selectable.
 */
export function canRenderPicker(options: StoreProductOption[], variants: StoreProductVariant[]): boolean {
  if (options.length === 0) return false
  return variants.some((variant) => Object.keys(variant.optionValues).length > 0)
}

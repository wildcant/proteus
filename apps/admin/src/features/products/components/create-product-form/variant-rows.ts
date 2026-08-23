import type { AdminCreateProduct, AdminProductOption } from '#/api/generated/model'
import type { OptionValueEntry } from '#/features/product-options/components/option-value-selector'

/** One row of the wizard's variant grid: a combination plus what the shopkeeper typed against it. */
export type VariantRow = {
  /** Order-independent identity, and what carries an edited row across a re-enumeration. */
  key: string
  /** The combination's label, e.g. `"M / White"`. Derived, so the grid shows it read-only. */
  label: string
  optionValues: Record<string, string>
  sku: string
  price: string
}

/**
 * The full matrix the selected options produce, in the product's option order.
 *
 * Mirrors the server's `buildCombinations` for a product that does not exist yet: there is no
 * server state to be authoritative about, and every row is validated against the real rules on
 * create. Options offering no values are dropped rather than multiplying the matrix to nothing.
 */
export function enumerateVariantRows(
  allOptions: AdminProductOption[],
  selected: OptionValueEntry[],
  existing: VariantRow[] = [],
): VariantRow[] {
  const optionById = new Map(allOptions.map((option) => [option.id, option]))

  const dimensions = selected.flatMap((entry) => {
    const option = optionById.get(entry.optionId)
    if (!option) return []
    const values = option.values.filter((value) => entry.valueIds.includes(value.id))
    return values.length > 0 ? [{ optionId: option.id, values }] : []
  })

  if (dimensions.length === 0) return []

  const combinations = dimensions.reduce<Array<Array<{ optionId: string; valueId: string; value: string }>>>(
    (rows, dimension) =>
      rows.flatMap((row) =>
        dimension.values.map((value) => [
          ...row,
          { optionId: dimension.optionId, valueId: value.id, value: value.value },
        ]),
      ),
    [[]],
  )

  // Keyed rather than positional, so adding a value further up the matrix does not silently move
  // an edited SKU onto a different variant.
  const editedByKey = new Map(existing.map((row) => [row.key, row]))

  return combinations.map((values) => {
    const optionValues = Object.fromEntries(values.map((value) => [value.optionId, value.valueId]))
    const key = combinationKey(optionValues)
    const edited = editedByKey.get(key)

    return {
      key,
      label: values.map((value) => value.value).join(' / '),
      optionValues,
      sku: edited?.sku ?? '',
      price: edited?.price ?? '',
    }
  })
}

/** Order-independent identity for a combination, matching the server's `combinationKey`. */
export function combinationKey(optionValues: Record<string, string>): string {
  return Object.entries(optionValues)
    .map(([optionId, valueId]) => `${optionId}=${valueId}`)
    .sort()
    .join('|')
}

/**
 * The `options` and `variants` halves of the create payload.
 *
 * A product without variations still gets one variant — an option-less variant the server titles
 * after the product — because a product with none cannot be added to a cart. `variantRank` follows
 * the sortable list's order, which is what the storefront reads.
 *
 * Built as the wire type rather than parsed through `AdminCreateProduct`: the schema's price
 * pipeline outputs a `BigNumber`, which is not what the endpoint takes. Nothing here needs
 * stripping anyway — these rows are enumerated, not typed by hand.
 */
export function resolveVariantsPayload(variants: {
  hasVariants: boolean
  options: OptionValueEntry[]
  rows: VariantRow[]
}): Pick<AdminCreateProduct, 'options' | 'variants'> {
  if (!variants.hasVariants || variants.rows.length === 0) {
    return { variants: [{ optionValues: {} }] }
  }

  return {
    options: variants.options,
    variants: variants.rows.map((row, index) => ({
      optionValues: row.optionValues,
      variantRank: index,
      ...(row.sku ? { sku: row.sku } : {}),
      ...(row.price ? { prices: [{ amount: row.price }] } : {}),
    })),
  }
}

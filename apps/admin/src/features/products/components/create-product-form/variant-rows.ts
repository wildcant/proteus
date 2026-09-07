import type { AdminCreateProduct, AdminProductOption } from '#/api/generated/model'
import type { OptionValueEntry } from '#/features/product-options/components/option-value-selector'
import type { CurrencyAmounts } from '#/features/products/utils/price-columns'

/** One row of the wizard's variant grid: a combination plus what the shopkeeper typed against it. */
export type VariantRow = {
  /** Order-independent identity, and what carries an edited row across a re-enumeration. */
  key: string
  /** The combination's label, e.g. `"M / White"`. Derived, so the grid shows it read-only. */
  label: string
  optionValues: Record<string, string>
  sku: string
  /**
   * One amount per store currency, keyed by ISO code. Blank means the variant is not priced in
   * that currency — which is allowed: a product does not have to be sellable in every market on
   * the day it is created.
   */
  prices: CurrencyAmounts
}

/**
 * The row as the grid holds it: `label`, `sku`, and one key per currency, all flat.
 *
 * `DataGridColumn` reaches a value by a single key, so the nested `prices` has to be spread out for
 * the grid and folded back afterwards. The projection is here rather than in the form because it is
 * the other half of the row shape above, and the two only make sense together.
 */
export type VariantGridRow = Record<string, string>

export function toVariantGridRows(rows: VariantRow[]): VariantGridRow[] {
  return rows.map((row) => ({ label: row.label, sku: row.sku, ...row.prices }))
}

/**
 * Folds the grid's edits back onto the rows they were projected from, by position — the grid never
 * adds, removes or reorders rows, so index is identity for the round trip.
 */
export function fromVariantGridRows(rows: VariantRow[], gridRows: VariantGridRow[]): VariantRow[] {
  return rows.map((row, index) => {
    const gridRow = gridRows[index]
    if (!gridRow) return row
    const { label: _label, sku, ...prices } = gridRow
    return { ...row, sku: sku ?? '', prices }
  })
}

/**
 * A row's price cells for the currencies the store sells in today, carrying over whatever was
 * already typed. A currency the store has dropped is dropped with it rather than quietly submitted.
 */
function seedPrices(currencyCodes: string[], existing?: CurrencyAmounts): CurrencyAmounts {
  return Object.fromEntries(currencyCodes.map((currencyCode) => [currencyCode, existing?.[currencyCode] ?? '']))
}

/**
 * The full matrix the selected options produce, in the product's option order.
 *
 * A second cartesian product, knowingly: `/option-combinations` is scoped to a product, and this
 * one does not exist yet, so there is no server answer to ask for. The divergence ADR 0015 warns
 * about — offering a combination the save then rejects — is closed by the create call validating
 * every row against the real rules. Options offering no values are dropped rather than multiplying
 * the matrix to nothing.
 */
export function enumerateVariantRows(
  allOptions: AdminProductOption[],
  selected: OptionValueEntry[],
  existing: VariantRow[] = [],
  currencyCodes: string[] = [],
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
    const key = variantRowKey(optionValues)
    const edited = editedByKey.get(key)

    return {
      key,
      label: values.map((value) => value.value).join(' / '),
      optionValues,
      sku: edited?.sku ?? '',
      prices: seedPrices(currencyCodes, edited?.prices),
    }
  })
}

/**
 * Identity for a row of the grid, order-independent so it survives a re-enumeration.
 *
 * Deliberately not the server's `combinationKey`, despite computing the same string: this one is
 * never sent — `resolveVariantsPayload` drops it — and never compared against one the server sent.
 * It is a `Map` key for carrying an edited SKU, so either side is free to change its format without
 * telling the other. Sharing an implementation would turn that freedom into a deploy dependency.
 */
function variantRowKey(optionValues: Record<string, string>): string {
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
    variants: variants.rows.map((row, index) => {
      // One price per currency the merchant actually typed into. A blank cell is not a zero: it
      // means this variant is not priced in that market yet, and sending it would put the variant
      // on sale for nothing there.
      const prices = Object.entries(row.prices)
        .filter(([, amount]) => amount !== '')
        .map(([currencyCode, amount]) => ({ currencyCode, amount }))

      return {
        optionValues: row.optionValues,
        variantRank: index,
        ...(row.sku ? { sku: row.sku } : {}),
        ...(prices.length > 0 ? { prices } : {}),
      }
    }),
  }
}

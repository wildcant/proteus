import type { AdminProductOption, AdminProductVariant } from '#/api/generated/model'

export type MatrixRow = {
  /** Stable key for React and for row selection — the option value ids, joined. */
  key: string
  /** Generated from the values, joined with " / " to match the seed's convention. */
  title: string
  sku: string
  optionValues: Record<string, string>
}

/**
 * Every combination of the chosen values, one row per variant to create.
 *
 * Combinations a variant already carries are dropped: the backend rejects them with a
 * duplicate-combination error, and it is friendlier to never offer them than to fail on save.
 */
export function buildVariantMatrix({
  options,
  selectedValueIds,
  existingVariants,
  skuPrefix = '',
}: {
  options: AdminProductOption[]
  /** Chosen values per option id. An option with none selected contributes nothing. */
  selectedValueIds: Record<string, string[]>
  existingVariants: AdminProductVariant[]
  skuPrefix?: string
}): MatrixRow[] {
  const usable = options.filter((option) => (selectedValueIds[option.id] ?? []).length > 0)
  // A partial tuple is rejected by the service, so nothing can be built until every option is
  // represented.
  if (usable.length === 0 || usable.length !== options.length) return []

  const taken = new Set(existingVariants.map((variant) => tupleKey(options, variant.optionValues)))

  const combinations = usable.reduce<Array<Record<string, string>>>(
    (rows, option) =>
      rows.flatMap((row) => (selectedValueIds[option.id] ?? []).map((valueId) => ({ ...row, [option.id]: valueId }))),
    [{}],
  )

  return combinations.flatMap((optionValues) => {
    const key = tupleKey(options, optionValues)
    if (taken.has(key)) return []

    const labels = options.map((option) => labelOf(option, optionValues[option.id]))
    return {
      key,
      title: labels.join(' / '),
      sku: skuPrefix ? [skuPrefix, ...labels].join('-').toUpperCase().replace(/\s+/g, '-') : '',
      optionValues,
    }
  })
}

/** Order-independent identity for a tuple, so it survives key ordering differences. */
function tupleKey(options: AdminProductOption[], optionValues: Record<string, string>): string {
  return options
    .map((option) => `${option.id}=${optionValues[option.id] ?? ''}`)
    .sort()
    .join('|')
}

function labelOf(option: AdminProductOption, valueId: string | undefined): string {
  return option.values.find((value) => value.id === valueId)?.value ?? ''
}

/**
 * The option-combination rules, as pure functions over plain data.
 *
 * Everything users do with options is a question about combinations — which ones a product
 * already sells, which it could still sell, which are buyable right now. Answering them here
 * rather than in each client is what stops "what we offer" and "what we accept" from drifting
 * apart: the admin endpoint and the service's duplicate rejection both come from `buildCombinations`.
 *
 * See `docs/adr/0015-server-computed-option-projections.md`.
 */

/**
 * Above this, a product's options are refused rather than enumerated. The count is the product of
 * the value counts, so it climbs multiplicatively — six options of ten values is a million rows.
 */
export const MAX_OPTION_COMBINATIONS = 10_000

/** Structurally satisfied by `ProductOptionWithValuesDTO`, in the product's rank order. */
export type CombinableOption = {
  id: string
  title: string
  values: ReadonlyArray<{ id: string; value: string }>
}

/** Structurally satisfied by an enriched variant. `inStock` only matters to the picker. */
export type CombinableVariant = {
  id: string
  optionValues: Readonly<Record<string, string>>
  inStock?: boolean
}

export type OptionCombinationValue = {
  optionId: string
  optionTitle: string
  valueId: string
  value: string
}

export type OptionCombination = {
  /** Stable identity, independent of key order. */
  key: string
  /** The values joined in the product's option order, e.g. `"M / White"`. */
  label: string
  /** Resolved, in the product's option order — the array both the label and the table read. */
  values: OptionCombinationValue[]
  /** The map a client posts back to create or update a variant. */
  optionValues: Record<string, string>
  /** The variant carrying this combination, or `null` while it is still available. */
  variantId: string | null
}

/** How many combinations a product could sell, without building any of them. */
export function countCombinations(options: readonly CombinableOption[]): number {
  // Zero rather than the empty product's mathematical 1: a variant with no options is not a
  // combination of anything, and the size ceiling must not be handed a phantom row.
  if (options.length === 0) return 0
  return options.reduce((total, option) => total * option.values.length, 1)
}

/**
 * What a set of resolved values is called. The one place a Variant Title is spelled — every other
 * caller goes through here, so a title can never disagree with the combination it stands for.
 */
export function combinationLabel(values: ReadonlyArray<{ value: string }>): string {
  return values.map((value) => value.value).join(' / ')
}

/**
 * Order-independent identity for a combination. The option is part of each pair, so a value used
 * under two different options cannot collide.
 */
export function combinationKey(optionValues: Readonly<Record<string, string>>): string {
  return Object.entries(optionValues)
    .map(([optionId, valueId]) => `${optionId}=${valueId}`)
    .sort()
    .join('|')
}

/**
 * Every combination the product could sell, each knowing whether a variant already has it.
 *
 * A fold rather than recursion: seeding with one empty row makes the cartesian product fall out
 * without a base case, and the tail is never rebuilt per head value.
 */
export function buildCombinations({
  options,
  variants,
}: {
  options: readonly CombinableOption[]
  variants: readonly CombinableVariant[]
}): OptionCombination[] {
  if (countCombinations(options) === 0) return []

  // Variants with a partial combination need no filtering: their key carries fewer pairs than any
  // full combination's, so it can never match one. They simply hide nothing.
  const variantIdByKey = new Map(variants.map((variant) => [combinationKey(variant.optionValues), variant.id]))

  const rows = options.reduce<OptionCombinationValue[][]>(
    (accumulated, option) =>
      accumulated.flatMap((row) =>
        option.values.map((value) => [
          ...row,
          { optionId: option.id, optionTitle: option.title, valueId: value.id, value: value.value },
        ]),
      ),
    [[]],
  )

  return rows.map((values) => {
    const optionValues = Object.fromEntries(values.map((value) => [value.optionId, value.valueId]))
    const key = combinationKey(optionValues)

    return {
      key,
      label: combinationLabel(values),
      values,
      optionValues,
      variantId: variantIdByKey.get(key) ?? null,
    }
  })
}

/** The combination a payload names, or `undefined` when it is incomplete or names unknown values. */
export function findCombination(
  combinations: readonly OptionCombination[],
  optionValues: Readonly<Record<string, string>>,
): OptionCombination | undefined {
  const key = combinationKey(optionValues)
  return combinations.find((combination) => combination.key === key)
}

/**
 * The storefront picker, precomputed: for each variant a shopper could be looking at, where every
 * option value would take them. `null` means the value is not reachable from there.
 *
 * Options resolve **left to right** — a value on option *k* is reachable when some buyable variant
 * carries it alongside the current selection for options `0..k-1`. The first option is therefore
 * always open, which is what keeps every combination reachable. Constraining each option by *all*
 * the others instead dead-ends: given only `S/Blue` and `M/Black`, sitting on `M/Black` would grey
 * out both `S` and `Blue`.
 *
 * The storefront reads `isSelected` as `target === selectedVariantId`, which holds because a
 * variant always wins the lookup for its own values.
 */
export function buildPickerTargets({
  options,
  variants,
}: {
  options: readonly CombinableOption[]
  variants: readonly CombinableVariant[]
}): Record<string, Record<string, string | null>> {
  const complete = variants.filter((variant) => Object.keys(variant.optionValues).length === options.length)

  return Object.fromEntries(
    variants.map((selected) => {
      if (Object.keys(selected.optionValues).length !== options.length) return [selected.id, {}]

      const targets: Record<string, string | null> = {}

      options.forEach((option, index) => {
        const prefix = options.slice(0, index)

        for (const value of option.values) {
          const candidates = complete.filter(
            (candidate) =>
              candidate.optionValues[option.id] === value.id &&
              prefix.every((earlier) => candidate.optionValues[earlier.id] === selected.optionValues[earlier.id]) &&
              // A shopper can navigate straight to a sold-out variant; it stays selectable so the
              // picker still shows what they are looking at.
              (candidate.inStock !== false || candidate.id === selected.id),
          )

          // Keep as much of the current selection as possible, so switching Size does not silently
          // change Colour. Scoring also guarantees the selected variant wins its own values.
          const best = candidates.reduce<CombinableVariant | undefined>((winner, candidate) => {
            if (!winner) return candidate
            return overlapWith(selected, candidate, options) > overlapWith(selected, winner, options)
              ? candidate
              : winner
          }, undefined)

          targets[value.id] = best?.id ?? null
        }
      })

      return [selected.id, targets]
    }),
  )
}

/** How many options two variants agree on — the tie-breaker for which variant a value leads to. */
function overlapWith(
  selected: CombinableVariant,
  candidate: CombinableVariant,
  options: readonly CombinableOption[],
): number {
  return options.filter((option) => candidate.optionValues[option.id] === selected.optionValues[option.id]).length
}

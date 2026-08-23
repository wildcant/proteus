/**
 * What changing a product's options does to its variants, as a pure function over plain data.
 *
 * A product's variants are derived from its options: every variant carries exactly one value for
 * each option the product offers. Editing the options is therefore not something to refuse when
 * variants exist — it is something the variant set has to follow. This plans that change so the
 * admin can see it before it happens and the workflow can apply it with compensation.
 *
 * See `.tasks/variant-option-reconciliation.md`.
 */

import {
  buildCombinations,
  type CombinableOption,
  combinationKey,
  type OptionCombination,
} from './option-combinations.js'

/**
 * How many variants one product may end up with. Distinct from `MAX_OPTION_COMBINATIONS`, which
 * only bounds enumerating combinations for a combobox: listing ten thousand rows is cheap, writing
 * ten thousand variants is not.
 */
export const MAX_VARIANTS_PER_PRODUCT = 1_000

/** Structurally satisfied by `ProductVariantDTO` plus its combination. */
export type ReconcilableVariant = {
  id: string
  title: string
  /** The values it carries today, keyed by option. */
  optionValues: Readonly<Record<string, string>>
  /** Breaks the tie when a collapse forces a choice between two variants. */
  createdAt: Date
}

/** Why a variant cannot survive the change. Both are shown to the admin before the save. */
export type VariantRemovalReason =
  /** It carries a value the product will no longer offer. */
  | 'value-dropped'
  /** Dropping an option landed it on a combination an older variant already holds. */
  | 'collapsed'

export type PlannedReassignment = {
  variantId: string
  /** What it was called before, for the admin to read alongside the new label. */
  fromLabel: string
  combination: OptionCombination
}

export type VariantReconciliationPlan = {
  keep: Array<{ variantId: string; combination: OptionCombination }>
  reassign: PlannedReassignment[]
  create: Array<{ combination: OptionCombination; copyPricesFromVariantId: string | null }>
  remove: Array<{ variantId: string; title: string; reason: VariantRemovalReason }>
}

type PlanInput = {
  /** Needed only to name what a variant is moving away from, including values being dropped. */
  currentOptions: readonly CombinableOption[]
  nextOptions: readonly CombinableOption[]
  variants: readonly ReconcilableVariant[]
}

/** The empty combination, which is what every variant of an option-less product carries. */
const NO_COMBINATION: OptionCombination = { key: '', label: '', values: [], optionValues: {}, variantId: null }

export function planVariantReconciliation({ currentOptions, nextOptions, variants }: PlanInput) {
  // An option offering nothing is not a dimension the product varies along. Left in, it would
  // multiply the combination count to zero and plan the deletion of the entire catalogue.
  const options = nextOptions.filter((option) => option.values.length > 0)

  const plan: VariantReconciliationPlan = { keep: [], reassign: [], create: [], remove: [] }

  // Oldest first, so a collapse resolves toward the variant that has been sold the longest.
  const byAge = [...variants].sort(
    (left, right) => left.createdAt.getTime() - right.createdAt.getTime() || left.id.localeCompare(right.id),
  )

  if (options.length === 0) {
    // A product offering no options can sell exactly one combination — the empty one — so the same
    // collapse rule applies here as anywhere else. Keeping them all would leave every survivor of
    // dropping the last option standing for nothing, sharing the product's name and each other's.
    const [survivor, ...collapsed] = byAge

    if (survivor) {
      const isAlreadyBare = Object.keys(survivor.optionValues).length === 0
      if (isAlreadyBare) {
        plan.keep.push({ variantId: survivor.id, combination: NO_COMBINATION })
      } else {
        plan.reassign.push({
          variantId: survivor.id,
          fromLabel: labelFor(currentOptions, survivor.optionValues),
          combination: NO_COMBINATION,
        })
      }
    }

    for (const variant of collapsed) {
      plan.remove.push({ variantId: variant.id, title: variant.title, reason: 'collapsed' })
    }

    return plan
  }

  const combinationByKey = new Map(
    buildCombinations({ options, variants: [] }).map((combination) => [combination.key, combination]),
  )
  const claimedBy = new Map<string, ReconcilableVariant>()

  for (const variant of byAge) {
    const fromLabel = labelFor(currentOptions, variant.optionValues)

    const droppedValue = options.some(
      (option) =>
        variant.optionValues[option.id] !== undefined &&
        !option.values.some((value) => value.id === variant.optionValues[option.id]),
    )
    if (droppedValue) {
      plan.remove.push({ variantId: variant.id, title: variant.title, reason: 'value-dropped' })
      continue
    }

    // A value it still carries, or the option's first — which is where a newly added option puts
    // every variant that predates it.
    const projected = Object.fromEntries(
      options.map((option) => [option.id, variant.optionValues[option.id] ?? option.values[0]?.id ?? '']),
    )
    const combination = combinationByKey.get(combinationKey(projected))
    if (!combination) continue

    const older = claimedBy.get(combination.key)
    if (older) {
      plan.remove.push({ variantId: variant.id, title: variant.title, reason: 'collapsed' })
      continue
    }
    claimedBy.set(combination.key, variant)

    if (combination.key === combinationKey(variant.optionValues)) {
      plan.keep.push({ variantId: variant.id, combination })
      continue
    }

    // The title is not carried across: it is derived from the combination, so it follows.
    plan.reassign.push({ variantId: variant.id, fromLabel, combination })
  }

  const survivors = [...claimedBy.values()]
  for (const combination of combinationByKey.values()) {
    if (claimedBy.has(combination.key)) continue
    plan.create.push({
      combination,
      copyPricesFromVariantId: nearestSurvivor(survivors, claimedBy, combination)?.id ?? null,
    })
  }

  return plan
}

/**
 * The survivor a new variant should inherit from: the one landing on the most values in common.
 *
 * Diverges from Shopify, which seeds every new row from one product-wide default. Adding a Size to
 * a product priced by Colour should give `XL / Charcoal` the Charcoal price, not the product's.
 */
function nearestSurvivor(
  survivors: readonly ReconcilableVariant[],
  claimedBy: ReadonlyMap<string, ReconcilableVariant>,
  target: OptionCombination,
): ReconcilableVariant | undefined {
  const landedOn = new Map([...claimedBy].map(([key, variant]) => [variant.id, key]))

  return survivors.reduce<ReconcilableVariant | undefined>((winner, candidate) => {
    if (!winner) return candidate
    return overlap(landedOn.get(candidate.id), target) > overlap(landedOn.get(winner.id), target) ? candidate : winner
  }, undefined)
}

/** How many `optionId=valueId` pairs two combination keys share. */
function overlap(key: string | undefined, target: OptionCombination): number {
  if (!key) return 0
  const pairs = new Set(target.key.split('|'))
  return key.split('|').filter((pair) => pairs.has(pair)).length
}

/** What a set of carried values is called, using whichever options can still name them. */
function labelFor(options: readonly CombinableOption[], optionValues: Readonly<Record<string, string>>): string {
  return options
    .flatMap((option) => option.values.filter((value) => value.id === optionValues[option.id]).map((v) => v.value))
    .join(' / ')
}

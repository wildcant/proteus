import type { AdminProductScopedOption } from '#/api/generated/model'
import type { OptionValueEntry } from './components/option-value-selector'

export type OptionChangeConsequences = {
  /** Values being unlinked that variants still carry, with how many each would delete. */
  droppedValues: Array<{ label: string; variantCount: number }>
  /** Options being unlinked entirely, which merge variants differing only by them. */
  droppedOptions: string[]
  /** Whether anything here destroys a variant. */
  isDestructive: boolean
}

/**
 * What saving this option set would destroy, said only as far as the data honestly supports.
 *
 * A dropped value deletes exactly the variants carrying it, and `variantCount` is that number
 * measured server-side. A dropped *option* is different: its variants collapse onto whatever
 * combinations remain, and how many survive is a function of the whole variant set. Working that
 * out here would mean re-implementing the reconciler's collapse rule in the client — the drift
 * ADR 0015 exists to prevent — so a dropped option is named rather than counted.
 */
export function describeOptionChange(
  currentOptions: AdminProductScopedOption[],
  next: OptionValueEntry[],
): OptionChangeConsequences {
  const nextByOptionId = new Map(next.map((entry) => [entry.optionId, new Set(entry.valueIds)]))

  const droppedOptions = currentOptions.filter((option) => !nextByOptionId.has(option.id)).map((option) => option.title)

  const droppedValues = currentOptions.flatMap((option) => {
    const keptValueIds = nextByOptionId.get(option.id)
    if (!keptValueIds) return []
    return option.values
      .filter((value) => !keptValueIds.has(value.id) && value.variantCount > 0)
      .map((value) => ({ label: `${option.title} / ${value.value}`, variantCount: value.variantCount }))
  })

  return {
    droppedValues,
    droppedOptions,
    isDestructive: droppedValues.length > 0 || droppedOptions.length > 0,
  }
}

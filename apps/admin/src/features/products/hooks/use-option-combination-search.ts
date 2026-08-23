import { useState } from 'react'
import type { AdminOptionCombination } from '#/api/generated/model'
import { useOptionCombinations } from '#/features/products/api/product-variants'
import { useDebouncedValue } from '#/hooks/use-debounced-value'

/** A combination as the combobox sees it: selectable by `id`, still carrying its `optionValues`. */
export type CombinationOption = AdminOptionCombination & { id: string }

type UseOptionCombinationSearchArgs = {
  productId: string
  /** The variant being edited, so the combination it already holds stays pickable. */
  variantId?: string
}

/**
 * The Combination combobox, for whichever form is rendering it.
 *
 * Searched and scoped server-side, so the query follows what was typed rather than the page being
 * narrowed locally — which is what lets this work for a product with thousands of combinations, and
 * what stops a page of taken ones from arriving empty.
 *
 * The two flags read the product's own totals rather than the searched `count`: "has no options"
 * and "every combination is taken" are facts about the product, and reading them off the query
 * makes a search that matches nothing look like a product with no options at all.
 */
export function useOptionCombinationSearch({ productId, variantId }: UseOptionCombinationSearchArgs) {
  const [search, setSearch] = useState('')
  const { data, isPending } = useOptionCombinations(productId, {
    label: useDebouncedValue(search) || undefined,
    scope: 'available',
    variantId,
  })

  // `id` is what a combobox selects by; the rest of the combination rides along so the form can
  // hold the whole thing rather than look it up again against a list that may have moved on.
  const combinations: CombinationOption[] = (data?.combinations ?? []).map((combination) => ({
    ...combination,
    id: combination.key,
  }))

  return {
    /** Already scoped to what this form may pick, so nothing here decides what is offered. */
    combinations,
    /** The one `variantId` holds today, which is what seeds the edit form's default. */
    current: combinations.find((combination) => combination.variantId === variantId),
    onSearchChange: setSearch,
    hasNoOptions: !isPending && data?.totalCombinations === 0,
    /** The product has options, but every combination of them is spoken for. */
    isExhausted: !isPending && (data?.totalCombinations ?? 0) > 0 && data?.availableCombinations === 0,
    isPending,
  }
}

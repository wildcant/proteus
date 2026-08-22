import { useState } from 'react'
import type { AdminOptionCombination } from '#/api/generated/model'
import { useOptionCombinations } from '#/features/products/api/product-variants'
import { useDebouncedValue } from '#/hooks/use-debounced-value'

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

  const combinations = data?.combinations ?? []
  const byKey = new Map(combinations.map((combination) => [combination.key, combination]))

  return {
    /** Already scoped to what this form may pick, so nothing here decides what is offered. */
    combinations,
    /** The combination a combobox item stands for, since the combobox only carries its key. */
    combinationFor: (key: string | null): AdminOptionCombination | null => (key ? (byKey.get(key) ?? null) : null),
    /** The one `variantId` holds today, which is what seeds the edit form's default. */
    current: combinations.find((combination) => combination.variantId === variantId),
    onSearchChange: setSearch,
    hasNoOptions: !isPending && data?.totalCombinations === 0,
    /** The product has options, but every combination of them is spoken for. */
    isExhausted: !isPending && (data?.totalCombinations ?? 0) > 0 && data?.availableCombinations === 0,
    isPending,
  }
}

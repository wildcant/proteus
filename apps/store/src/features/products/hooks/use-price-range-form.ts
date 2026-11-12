import { useAppForm } from '#/lib/form-hook'

export type PriceRange = { minPrice?: number; maxPrice?: number }

/** An empty field leaves its end of the range open rather than reading as 0. */
const amountOf = (value: string): number | undefined => {
  const amount = Number(value)
  return value.trim() === '' || Number.isNaN(amount) ? undefined : amount
}

/** The price menu's two amounts, as text while typed, handed back as the range they describe. */
export function usePriceRangeForm(range: PriceRange, onApply: (range: PriceRange) => void) {
  const form = useAppForm({
    defaultValues: { minPrice: range.minPrice?.toString() ?? '', maxPrice: range.maxPrice?.toString() ?? '' },
    onSubmit: ({ value }) => onApply({ minPrice: amountOf(value.minPrice), maxPrice: amountOf(value.maxPrice) }),
  })

  return { form }
}

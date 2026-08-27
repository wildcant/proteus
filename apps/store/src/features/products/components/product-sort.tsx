import { ChevronDownIcon } from 'lucide-react'
import {
  PRODUCT_SORT_LABELS,
  PRODUCT_SORT_NAMES,
  type ProductSort as ProductSortName,
} from '#/features/products/api/products'

type ProductSortProps = {
  value: ProductSortName
  onChange: (sort: ProductSortName) => void
}

/**
 * A native `<select>`, so the platform renders the bottom sheet a phone wants without this file
 * owning any modal state.
 *
 * Its own control rather than `@proteus/ui`'s `NativeSelect`, for the reason `components/form/select.tsx`
 * gives: that primitive's `className` reaches its wrapper only, and its hardcoded 32px height
 * misses the 44px thumb target the pager sets as the floor. No border here — the bar's own rules
 * are the only ones this needs.
 */
export function ProductSort({ value, onChange }: ProductSortProps) {
  return (
    <div className="relative">
      <label className="sr-only" htmlFor="product-sort">
        Sort by
      </label>
      <select
        id="product-sort"
        value={value}
        onChange={(event) => onChange(event.target.value as ProductSortName)}
        // 16px below `md` so iOS does not zoom the page on focus.
        className="h-11 cursor-pointer appearance-none bg-transparent py-0 pr-6 pl-0 text-base text-ink outline-none md:text-sm"
      >
        {PRODUCT_SORT_NAMES.map((name) => (
          <option key={name} value={name}>
            {PRODUCT_SORT_LABELS[name]}
          </option>
        ))}
      </select>
      <ChevronDownIcon
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-0 size-4 -translate-y-1/2 text-ink-muted"
      />
    </div>
  )
}

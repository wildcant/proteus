import { Trans, useLingui } from '@lingui/react/macro'
import { cn } from '@proteus/ui-core'
import { Icon } from '#/components/ui/icon/icon'
import {
  PRODUCT_SORT_LABELS,
  PRODUCT_SORT_NAMES,
  type ProductSort as ProductSortName,
} from '#/features/products/api/products'
import {
  productSort,
  productSortChevron,
  productSortGlyph,
  productSortValue,
} from '#/features/products/components/product-sort/product-sort.variants'

type ProductSortProps = {
  value: ProductSortName
  onChange: (sort: ProductSortName) => void
  className?: string
}

/**
 * A native `<select>`, so the platform renders the bottom sheet a phone wants without this file
 * owning any modal state.
 *
 * Its own control rather than `@proteus/ui`'s `NativeSelect`: that primitive is a bordered box,
 * and the bar's own rules are the only ones this needs. `components/market-select.tsx` is the same
 * shape on the primitive if this ever wants to follow.
 */
export function ProductSort({ value, onChange, className }: ProductSortProps) {
  const { t } = useLingui()

  return (
    <div className={cn(productSort(), className)}>
      <label className="sr-only" htmlFor="product-sort">
        <Trans>Sort by</Trans>
      </label>
      {/* 16px below `md` so iOS does not zoom the page on focus. `-mr-6 pr-6` runs the select under
          the chevron, so the whole control is the hit area. */}
      <select
        id="product-sort"
        value={value}
        onChange={(event) => onChange(event.target.value as ProductSortName)}
        className={cn(
          productSortValue(),
          '-mr-6 h-full cursor-pointer appearance-none bg-transparent py-0 pr-6 pl-0 outline-none',
        )}
      >
        {PRODUCT_SORT_NAMES.map((name) => (
          <option key={name} value={name}>
            {t(PRODUCT_SORT_LABELS[name])}
          </option>
        ))}
      </select>
      <Icon
        name="chevron-down"
        aria-hidden="true"
        className={cn(productSortChevron(), productSortGlyph(), 'pointer-events-none')}
      />
    </div>
  )
}

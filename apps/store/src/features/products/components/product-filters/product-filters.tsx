import { Trans, useLingui } from '@lingui/react/macro'
import { cn } from '@proteus/ui-core'
import { useNavigate } from '@tanstack/react-router'
import { productFiltersQuery, useSuspenseProductFilters } from '#/features/products/api/product-filters'
import { FilterMenu } from '#/features/products/components/filter-menu/filter-menu'
import { PriceMenu } from '#/features/products/components/price-menu/price-menu'
import {
  productFilters,
  productFiltersClear,
  productFiltersClearLabel,
  productFiltersFilter,
} from '#/features/products/components/product-filters/product-filters.variants'
import type { ProductListView } from '#/features/products/types/product-list-view'
import { useMarket } from '#/hooks/use-market'

/** `genero:women` → the key and the value, which keeps any later colon. */
const splitSelection = (selection: string) => {
  const separator = selection.indexOf(':')
  return { key: selection.slice(0, separator), value: selection.slice(separator + 1) }
}

/**
 * A dropdown per filterable metafield ("Género", "Tipo") and per product option ("Talla", "Color")
 * over the products in view, each a checkbox per value with how many products it would leave, then a
 * price range. Choosing values of one filter widens the list, choosing across filters narrows it, and
 * a value no product would keep is disabled rather than hidden. The choices live in the URL as
 * `filter=<key>:<value>`, `minPrice` and `maxPrice`.
 *
 * A chosen value the list no longer offers — a stale link — still gets its checkbox, so the shopper
 * can always take it away.
 */
export function ProductFilters({ scope, search, links, className }: ProductListView & { className?: string }) {
  const { t } = useLingui()
  const navigate = useNavigate()
  const { current } = useMarket()
  const chosen = search.filter ?? []
  const { minPrice, maxPrice } = search
  const filters = useSuspenseProductFilters(
    productFiltersQuery({
      scope,
      q: search.q,
      tag: search.tag,
      filter: chosen,
      minPrice,
      maxPrice,
      countryCode: current.iso2,
    }),
  )

  const chosenOf = (key: string) =>
    chosen.map(splitSelection).flatMap((selection) => (selection.key === key ? [selection.value] : []))
  const shown = filters.filter((filter) => filter.values.length > 0 || chosenOf(filter.key).length > 0)
  const hasPrice = minPrice !== undefined || maxPrice !== undefined

  // Absent rather than empty, so an unfiltered list keeps its bare URL; page 1, because the old page
  // number belongs to another list.
  const write = (next: string[]) =>
    navigate(links.filter({ filter: next.length > 0 ? next : undefined, offset: undefined }))
  const toggle = (key: string, value: string) => {
    const selection = `${key}:${value}`
    write(chosen.includes(selection) ? chosen.filter((other) => other !== selection) : [...chosen, selection])
  }

  return (
    <fieldset className={cn(productFilters(), className)}>
      <legend className="sr-only">{t`Filters`}</legend>
      {shown.map((filter) => (
        <FilterMenu
          key={filter.key}
          filter={filter}
          chosen={chosenOf(filter.key)}
          onToggle={(value) => toggle(filter.key, value)}
          className={productFiltersFilter()}
        />
      ))}
      <PriceMenu
        // Remounted when the range changes elsewhere — "Clear all", a link — so its fields start from the URL.
        key={`${minPrice}-${maxPrice}`}
        minPrice={minPrice}
        maxPrice={maxPrice}
        onApply={(range) => navigate(links.filter({ ...range, offset: undefined }))}
        className={productFiltersFilter()}
      />
      {chosen.length > 0 || hasPrice ? (
        <button
          type="button"
          onClick={() =>
            navigate(
              links.clearFilters({ filter: undefined, minPrice: undefined, maxPrice: undefined, offset: undefined }),
            )
          }
          className={productFiltersClear()}
        >
          <span className={productFiltersClearLabel()}>
            <Trans>Clear all</Trans>
          </span>
        </button>
      ) : null}
    </fieldset>
  )
}

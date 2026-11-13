import { useLingui } from '@lingui/react/macro'
import { cn } from '@proteus/ui-core'
import { useNavigate } from '@tanstack/react-router'
import { productTagValuesQuery, useSuspenseProductTagValues } from '#/features/products/api/product-tags'
import {
  productTagFilter,
  productTagFilterChip,
} from '#/features/products/components/product-tag-filter/product-tag-filter.variants'
import { TagChip } from '#/features/products/components/tag-chip/tag-chip'
import type { ProductListView } from '#/features/products/types/product-list-view'
import { useMarket } from '#/hooks/use-market'

/**
 * A chip per Tag value on the products in view. Choosing one adds it to the URL, so the list shows
 * products carrying any chosen value; a chosen chip removes it again. The values come from the
 * products, not from this file, so the same chips serve any shop.
 *
 * A chosen value the list no longer offers — a stale link, a Tag since deleted — still gets its
 * chip, so the shopper can always take it away.
 */
export function ProductTagFilter({ scope, search, links, className }: ProductListView & { className?: string }) {
  const { t } = useLingui()
  const navigate = useNavigate()
  const { current } = useMarket()
  const values = useSuspenseProductTagValues(productTagValuesQuery({ scope, q: search.q, countryCode: current.iso2 }))
  const chosen = search.tag ?? []
  const chips = [...new Set([...values, ...chosen])]

  if (chips.length === 0) return null

  const toggle = (value: string) => {
    const next = chosen.includes(value) ? chosen.filter((tag) => tag !== value) : [...chosen, value]
    // Absent rather than empty, so an unfiltered list keeps its bare URL; page 1, because the old
    // page number belongs to another list.
    navigate(links.tag({ tag: next.length > 0 ? next : undefined, offset: undefined }))
  }

  return (
    <ul aria-label={t`Filter by tag`} className={cn(productTagFilter(), 'm-0 list-none p-0', className)}>
      {chips.map((value) => {
        const isChosen = chosen.includes(value)
        return (
          <li key={value} className={productTagFilterChip()}>
            <TagChip
              type="button"
              chosen={isChosen}
              aria-pressed={isChosen}
              aria-label={isChosen ? t`Remove filter ${value}` : undefined}
              onClick={() => toggle(value)}
            >
              {value}
            </TagChip>
          </li>
        )
      })}
    </ul>
  )
}

import { useLingui } from '@lingui/react/macro'
import { XIcon } from 'lucide-react'
import { productTagValuesQuery, useSuspenseProductTagValues } from '#/features/products/api/product-tags'
import type { ProductListView } from '#/features/products/utils/product-list-search'
import { useMarket } from '#/hooks/use-market'

/**
 * A chip per Tag value on the products in view. Choosing one adds it to the URL, so the list shows
 * products carrying any chosen value; a chosen chip removes it again. The values come from the
 * products, not from this file, so the same chips serve any shop.
 *
 * A chosen value the list no longer offers — a stale link, a Tag since deleted — still gets its
 * chip, so the shopper can always take it away.
 */
export function ProductTagFilter({ scope, search, onSearchChange }: ProductListView) {
  const { t } = useLingui()
  const { current } = useMarket()
  const values = useSuspenseProductTagValues(productTagValuesQuery({ scope, q: search.q, countryCode: current.iso2 }))
  const chosen = search.tag ?? []
  const chips = [...new Set([...values, ...chosen])]

  if (chips.length === 0) return null

  const toggle = (value: string) => {
    const next = chosen.includes(value) ? chosen.filter((tag) => tag !== value) : [...chosen, value]
    // Absent rather than empty, so an unfiltered list keeps its bare URL; page 1, because the old
    // page number belongs to another list.
    onSearchChange({ tag: next.length > 0 ? next : undefined, offset: undefined })
  }

  return (
    <ul aria-label={t`Filter by tag`} className="m-0 mt-6 flex list-none flex-wrap gap-2 p-0">
      {chips.map((value) => {
        const isChosen = chosen.includes(value)
        return (
          <li key={value}>
            <button
              type="button"
              aria-pressed={isChosen}
              aria-label={isChosen ? t`Remove filter ${value}` : undefined}
              onClick={() => toggle(value)}
              className={
                isChosen
                  ? 'flex h-10 items-center gap-2 border border-ink bg-ink px-4 text-sm text-surface'
                  : 'flex h-10 items-center border border-line px-4 text-ink text-sm hover:border-ink'
              }
            >
              {value}
              {isChosen ? <XIcon aria-hidden className="size-4" strokeWidth={1.5} /> : null}
            </button>
          </li>
        )
      })}
    </ul>
  )
}

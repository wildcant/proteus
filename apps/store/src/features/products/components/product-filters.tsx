import { Trans, useLingui } from '@lingui/react/macro'
import { cn } from '@proteus/ui-core'
import { ChevronDownIcon } from 'lucide-react'
import { useId, useState } from 'react'
import type { StoreProductFilter } from '#/api/generated/model'
import { Form } from '#/components/form/form'
import { Popover, PopoverContent, PopoverTrigger } from '#/components/popover'
import { Checkbox } from '#/components/ui/checkbox/checkbox'
import { productFiltersQuery, useSuspenseProductFilters } from '#/features/products/api/product-filters'
import { type PriceRange, usePriceRangeForm } from '#/features/products/hooks/use-price-range-form'
import type { ProductListView } from '#/features/products/utils/product-list-search'
import { useFormatters } from '#/hooks/use-formatters'
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
export function ProductFilters({ scope, search, onSearchChange }: ProductListView) {
  const { t } = useLingui()
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
  const write = (next: string[]) => onSearchChange({ filter: next.length > 0 ? next : undefined, offset: undefined })
  const toggle = (key: string, value: string) => {
    const selection = `${key}:${value}`
    write(chosen.includes(selection) ? chosen.filter((other) => other !== selection) : [...chosen, selection])
  }

  return (
    <fieldset className="mt-6 flex flex-wrap items-center gap-2">
      <legend className="sr-only">{t`Filters`}</legend>
      {shown.map((filter) => (
        <FilterMenu
          key={filter.key}
          filter={filter}
          chosen={chosenOf(filter.key)}
          onToggle={(value) => toggle(filter.key, value)}
        />
      ))}
      <PriceMenu
        // Remounted when the range changes elsewhere — "Clear all", a link — so its fields start from the URL.
        key={`${minPrice}-${maxPrice}`}
        minPrice={minPrice}
        maxPrice={maxPrice}
        onApply={(range) => onSearchChange({ ...range, offset: undefined })}
      />
      {chosen.length > 0 || hasPrice ? (
        <button
          type="button"
          onClick={() =>
            onSearchChange({ filter: undefined, minPrice: undefined, maxPrice: undefined, offset: undefined })
          }
          className="h-10 px-2 text-ink text-sm underline underline-offset-4 hover:text-ink-muted"
        >
          <Trans>Clear all</Trans>
        </button>
      ) : null}
    </fieldset>
  )
}

/** The price range, two amounts in the market's currency, either left empty to leave that end open. */
function PriceMenu({ minPrice, maxPrice, onApply }: PriceRange & { onApply: (range: PriceRange) => void }) {
  const { t } = useLingui()
  const { current } = useMarket()
  const { formatPrice } = useFormatters()
  const [open, setOpen] = useState(false)
  const { form } = usePriceRangeForm({ minPrice, maxPrice }, (range) => {
    onApply(range)
    setOpen(false)
  })
  const format = (amount: number) => formatPrice(String(amount), current.currencyCode)
  const hasPrice = minPrice !== undefined || maxPrice !== undefined

  const label = (() => {
    if (minPrice !== undefined && maxPrice !== undefined) return t`Price: ${format(minPrice)} – ${format(maxPrice)}`
    if (minPrice !== undefined) return t`Price: from ${format(minPrice)}`
    if (maxPrice !== undefined) return t`Price: up to ${format(maxPrice)}`
    return t`Price`
  })()

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          'flex h-10 cursor-pointer items-center gap-2 border px-4 text-ink text-sm',
          hasPrice ? 'border-ink' : 'border-line hover:border-ink',
        )}
      >
        {label}
        <ChevronDownIcon aria-hidden className="size-4" strokeWidth={1.5} />
      </PopoverTrigger>
      <PopoverContent align="start" aria-label={t`Price`} className="w-72 p-4">
        <Form onSubmit={form.handleSubmit} className="flex flex-col gap-3">
          <form.AppForm>
            <div className="grid grid-cols-2 gap-2">
              <form.AppField name="minPrice">
                {(field) => <field.TextField label={t`From`} type="number" />}
              </form.AppField>
              <form.AppField name="maxPrice">
                {(field) => <field.TextField label={t`To`} type="number" />}
              </form.AppField>
            </div>
            <form.SubmitButton>{t`Apply`}</form.SubmitButton>
          </form.AppForm>
        </Form>
      </PopoverContent>
    </Popover>
  )
}

function FilterMenu({
  filter,
  chosen,
  onToggle,
}: {
  filter: StoreProductFilter
  chosen: string[]
  onToggle: (value: string) => void
}) {
  const offered = new Set(filter.values.map(({ value }) => value))
  const values = [
    ...filter.values,
    ...chosen.filter((value) => !offered.has(value)).map((value) => ({ value, count: 0 })),
  ]

  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          'flex h-10 cursor-pointer items-center gap-2 border px-4 text-ink text-sm',
          chosen.length > 0 ? 'border-ink' : 'border-line hover:border-ink',
        )}
      >
        {/* The trigger names what is chosen, as the reference's does: "Género: women, men". */}
        {chosen.length > 0 ? `${filter.name}: ${chosen.join(', ')}` : filter.name}
        <ChevronDownIcon aria-hidden className="size-4" strokeWidth={1.5} />
      </PopoverTrigger>
      <PopoverContent align="start" aria-label={filter.name} className="min-w-56 py-2">
        <ul className="m-0 list-none p-0">
          {values.map(({ value, count }) => (
            <li key={value}>
              <FilterValue
                value={value}
                count={count}
                isChosen={chosen.includes(value)}
                onToggle={() => onToggle(value)}
              />
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  )
}

/** One checkbox row: disabled when choosing it would leave nothing, unless it is chosen and so must stay removable. */
function FilterValue({
  value,
  count,
  isChosen,
  onToggle,
}: {
  value: string
  count: number
  isChosen: boolean
  onToggle: () => void
}) {
  const id = useId()
  const isDisabled = count === 0 && !isChosen

  return (
    <div
      className={cn(
        'flex h-10 items-center gap-3 px-4 text-sm',
        isDisabled ? 'text-ink-subtle' : 'text-ink hover:bg-surface-subtle',
      )}
    >
      <Checkbox id={id} checked={isChosen} disabled={isDisabled} onCheckedChange={onToggle} />
      <label
        htmlFor={id}
        className={cn('flex flex-1 items-baseline gap-3', isDisabled ? 'cursor-not-allowed' : 'cursor-pointer')}
      >
        <span className="flex-1">{value}</span>
        <span className="text-ink-muted text-xs">({count})</span>
      </label>
    </div>
  )
}

import type { StoreProductFilter } from '#/api/generated/model'
import { Popover, PopoverContent } from '#/components/ui/popover/popover'
import { filterMenu, filterMenuValue } from '#/features/products/components/filter-menu/filter-menu.variants'
import { FilterTrigger } from '#/features/products/components/filter-trigger/filter-trigger'
import { FilterValue } from '#/features/products/components/filter-value/filter-value'

type FilterMenuProps = {
  filter: StoreProductFilter
  chosen: string[]
  onToggle: (value: string) => void
  /** The trigger's place in the caller's layout. */
  className?: string
}

/** One filter's trigger and its popover of values, a chosen value the list no longer offers included. */
export function FilterMenu({ filter, chosen, onToggle, className }: FilterMenuProps) {
  const offered = new Set(filter.values.map(({ value }) => value))
  const values = [
    ...filter.values,
    ...chosen.filter((value) => !offered.has(value)).map((value) => ({ value, count: 0 })),
  ]

  return (
    <Popover>
      <FilterTrigger chosen={chosen.length > 0} className={className}>
        {/* The trigger names what is chosen, as the reference's does: "Género: women, men". */}
        {chosen.length > 0 ? `${filter.name}: ${chosen.join(', ')}` : filter.name}
      </FilterTrigger>
      <PopoverContent align="start" aria-label={filter.name} className={filterMenu()}>
        <ul className="m-0 list-none p-0">
          {values.map(({ value, count }) => (
            <li key={value} className={filterMenuValue()}>
              <FilterValue
                value={value}
                count={count}
                isChosen={chosen.includes(value)}
                onToggle={() => onToggle(value)}
                className="w-full"
              />
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  )
}

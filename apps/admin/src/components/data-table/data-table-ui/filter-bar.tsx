import { Button } from '@proteus/ui'
import type { FilterDef, FilterValue } from '../types'
import { FilterMenu } from './filter-menu'
import { FilterPill } from './filter-pill'

type FilterBarProps = {
  filterDefs: FilterDef[]
  values: Record<string, FilterValue>
  pendingIds: Set<string>
  activeFilterIds: string[]
  onAddFilter: (id: string) => void
  onSetFilter: (id: string, value: FilterValue) => void
  onRemoveFilter: (id: string) => void
  onClearAll: () => void
  isPending: boolean
}

export function FilterBar({
  filterDefs,
  values,
  pendingIds,
  activeFilterIds,
  onAddFilter,
  onSetFilter,
  onRemoveFilter,
  onClearAll,
  isPending,
}: FilterBarProps) {
  const visibleFilters = filterDefs.filter((def) => values[def.id] != null || pendingIds.has(def.id))
  const hasFilters = visibleFilters.length > 0

  return (
    <div className="flex items-center gap-2">
      {visibleFilters.map((def) => (
        <FilterPill
          key={def.id}
          def={def}
          value={values[def.id] ?? null}
          isNew={pendingIds.has(def.id)}
          onChange={(v) => onSetFilter(def.id, v)}
          onRemove={() => onRemoveFilter(def.id)}
        />
      ))}
      {filterDefs.length > 0 && (
        <FilterMenu
          filterDefs={filterDefs}
          activeFilterIds={activeFilterIds}
          onAdd={onAddFilter}
          isPending={isPending}
        />
      )}
      {!!hasFilters && (
        <Button variant="ghost" size="xs" onClick={onClearAll}>
          Clear all
        </Button>
      )}
    </div>
  )
}

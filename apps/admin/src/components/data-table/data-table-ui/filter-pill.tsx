import { Popover, PopoverContent, PopoverTrigger } from '@proteus/ui'
import { XIcon } from 'lucide-react'
import { useCallback, useState } from 'react'
import { DateFilter } from '../filters/date-filter'
import { MultiselectFilter } from '../filters/multiselect-filter'
import { RadioFilter } from '../filters/radio-filter'
import { SelectFilter } from '../filters/select-filter'
import type { FilterDef, FilterValue } from '../types'
import { formatDisplayValue } from '../utils/format'

type FilterPillProps = {
  def: FilterDef
  value: FilterValue | null
  isNew?: boolean
  onChange: (value: FilterValue) => void
  onRemove: () => void
}

function FilterContent({
  def,
  value,
  onChange,
}: {
  def: FilterDef
  value: FilterValue | null
  onChange: (v: FilterValue) => void
}) {
  switch (def.type) {
    case 'radio':
      return <RadioFilter options={def.options} value={value as string} onChange={onChange} />
    case 'select':
      return <SelectFilter options={def.options} value={value as string} onChange={onChange} />
    case 'multiselect':
      return (
        <MultiselectFilter
          options={def.options}
          value={value as string[] | undefined}
          onChange={onChange}
          searchable={def.searchable}
        />
      )
    case 'date':
      return (
        <DateFilter
          value={value as { $gte?: string; $lte?: string } | undefined}
          onChange={onChange}
          presets={def.presets}
        />
      )
  }
}

const isEmptyValue = (value: FilterValue | null) =>
  value === null || value === '' || (Array.isArray(value) && value.length === 0)

export function FilterPill({ def, value, isNew = false, onChange, onRemove }: FilterPillProps) {
  const [open, setOpen] = useState(isNew)
  const hasValue = !isEmptyValue(value)

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      setOpen(nextOpen)
      // Closing a new filter without a value → auto-remove
      if (!nextOpen && isNew && !hasValue) {
        onRemove()
      }
    },
    [isNew, hasValue, onRemove],
  )

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <div className="flex shrink-0 items-center overflow-hidden rounded-md text-xs shadow-[0_0_0_1px] shadow-border">
        <span className="px-2 py-1 text-muted-foreground">{def.label}</span>
        {!!hasValue && (
          <>
            <span className="border-border border-x px-2 py-1 text-muted-foreground">is</span>
            <PopoverTrigger className="cursor-pointer border-border border-r px-2 py-1 font-medium transition-colors hover:bg-muted">
              {formatDisplayValue(value, def)}
            </PopoverTrigger>
          </>
        )}
        {!hasValue && (
          <PopoverTrigger className="cursor-pointer px-2 py-1 text-muted-foreground transition-colors hover:bg-muted">
            select...
          </PopoverTrigger>
        )}
        {!!hasValue && (
          <button
            type="button"
            onClick={onRemove}
            className="flex items-center px-1.5 py-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <XIcon className="size-3" />
          </button>
        )}
      </div>
      <PopoverContent align="start" className="w-56 p-1">
        <FilterContent def={def} value={value} onChange={onChange} />
      </PopoverContent>
    </Popover>
  )
}

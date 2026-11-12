import { cn } from '@proteus/ui-core'
import { useId } from 'react'
import { Checkbox } from '#/components/ui/checkbox/checkbox'
import {
  filterValue,
  filterValueCheckbox,
  filterValueCount,
  filterValueLabel,
  filterValueValue,
} from '#/features/products/components/filter-value/filter-value.variants'

type FilterValueProps = {
  value: string
  count: number
  isChosen: boolean
  onToggle: () => void
  className?: string
}

/** One checkbox row: disabled when choosing it would leave nothing, unless it is chosen and so must stay removable. */
export function FilterValue({ value, count, isChosen, onToggle, className }: FilterValueProps) {
  const id = useId()
  const isDisabled = count === 0 && !isChosen

  return (
    <div className={cn(filterValue({ disabled: isDisabled }), className)}>
      <Checkbox
        id={id}
        checked={isChosen}
        disabled={isDisabled}
        onCheckedChange={onToggle}
        className={filterValueCheckbox()}
      />
      <label htmlFor={id} className={cn(filterValueLabel(), isDisabled ? 'cursor-not-allowed' : 'cursor-pointer')}>
        <span className={filterValueValue({ disabled: isDisabled })}>{value}</span>
        <span className={filterValueCount()}>({count})</span>
      </label>
    </div>
  )
}

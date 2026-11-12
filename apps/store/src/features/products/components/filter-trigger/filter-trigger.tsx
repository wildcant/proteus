import { cn } from '@proteus/ui-core'
import { ChevronDownIcon } from 'lucide-react'
import { PopoverTrigger } from '#/components/ui/popover/popover'
import {
  filterTrigger,
  filterTriggerChevron,
  filterTriggerGlyph,
  filterTriggerLabel,
} from '#/features/products/components/filter-trigger/filter-trigger.variants'

type FilterTriggerProps = Omit<React.ComponentProps<typeof PopoverTrigger>, 'className'> & {
  /** Something in this menu is chosen, so the trigger names it and takes the ink border. */
  chosen: boolean
  className?: string
}

/** The bordered box that opens a filter menu or the price range. The label is the caller's text. */
export function FilterTrigger({ chosen, className, children, ...props }: FilterTriggerProps) {
  return (
    <PopoverTrigger
      className={cn(filterTrigger({ chosen }), filterTriggerLabel(), 'cursor-pointer', className)}
      {...props}
    >
      {children}
      <ChevronDownIcon aria-hidden className={cn(filterTriggerChevron(), filterTriggerGlyph())} strokeWidth={1.5} />
    </PopoverTrigger>
  )
}

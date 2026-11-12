import { cn } from '@proteus/ui-core'
import { CircleHelpIcon } from 'lucide-react'
import { useState } from 'react'
import { TRAILING_CONTROL } from '#/components/form/trailing-control.ts'
import { Tooltip, TooltipContent, TooltipTrigger } from '#/components/ui/tooltip/tooltip'

/**
 * The `?` at the end of a field, and the note it reveals.
 *
 * Open state is ours, not the primitive's: Base UI's tooltip hover is `mouseOnly`, so on a
 * phone the affordance would be inert — click toggles it, and `closeOnClick` is off so the
 * same tap doesn't close it. The note is the button's accessible name, so screen readers
 * hear the note instead of "help" plus an unhoverable tooltip.
 */
export function FieldHelp({ children, className }: { children: string; className?: string }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <Tooltip open={isOpen} onOpenChange={setIsOpen}>
      <TooltipTrigger
        closeOnClick={false}
        delay={150}
        onClick={() => setIsOpen((open) => !open)}
        render={<button type="button" className={cn(TRAILING_CONTROL, className)} />}
      >
        <CircleHelpIcon aria-hidden="true" className="size-5" />
        <span className="sr-only">{children}</span>
      </TooltipTrigger>
      <TooltipContent>{children}</TooltipContent>
    </Tooltip>
  )
}

import { Tooltip, TooltipContent, TooltipTrigger } from '@proteus/ui'
import { CircleHelpIcon } from 'lucide-react'
import { useState } from 'react'
import { TRAILING_CONTROL } from '#/components/form/trailing-control.ts'

/**
 * The `?` at the end of a field, and the note it reveals.
 *
 * Open state is ours, not the primitive's: Base UI's tooltip hover is `mouseOnly`, so on a
 * phone the affordance would be inert — click toggles it, and `closeOnClick` is off so the
 * same tap doesn't close it. The note is the button's accessible name, so screen readers
 * hear the note instead of "help" plus an unhoverable tooltip.
 */
export function FieldHelp({ children }: { children: string }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <Tooltip open={isOpen} onOpenChange={setIsOpen}>
      <TooltipTrigger
        closeOnClick={false}
        delay={150}
        onClick={() => setIsOpen((open) => !open)}
        render={<button type="button" className={TRAILING_CONTROL} />}
      >
        <CircleHelpIcon aria-hidden="true" className="size-5" />
        <span className="sr-only">{children}</span>
      </TooltipTrigger>
      <TooltipContent className="max-w-56 px-4 py-3 text-center font-extrabold text-surface text-xs uppercase leading-tight">
        {children}
      </TooltipContent>
    </Tooltip>
  )
}

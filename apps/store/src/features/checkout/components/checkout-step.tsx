import { Collapsible, CollapsibleContent } from '@proteus/ui'
import { CheckCircle2Icon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '#/components/button'

type CheckoutStepProps = {
  title: string
  stepNumber: number
  isOpen: boolean
  isComplete: boolean
  onEdit: () => void
  summary?: ReactNode
  children: ReactNode
}

export function CheckoutStep({ title, stepNumber, isOpen, isComplete, onEdit, summary, children }: CheckoutStepProps) {
  return (
    <Collapsible open={isOpen}>
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-full border border-border text-sm font-medium text-(--foreground-muted)">
            {isComplete ? <CheckCircle2Icon className="h-5 w-5 text-green-600" /> : String(stepNumber)}
          </span>
          <h2 className="text-lg font-medium text-foreground">{title}</h2>
        </div>
        {!isOpen && isComplete && (
          <Button variant="link" onClick={onEdit} className="text-sm">
            Edit
          </Button>
        )}
      </div>

      <CollapsibleContent>
        <div className="py-6">{children}</div>
      </CollapsibleContent>

      {!isOpen && isComplete && summary && <div className="py-4 text-sm text-(--foreground-muted)">{summary}</div>}
    </Collapsible>
  )
}

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
      <div className="flex items-center justify-between border-border border-b pb-3">
        <div className="flex items-center gap-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-full border border-border font-medium text-(--foreground-muted) text-sm">
            {isComplete ? <CheckCircle2Icon className="h-5 w-5 text-green-600" /> : String(stepNumber)}
          </span>
          <h2 className="font-medium text-foreground text-lg">{title}</h2>
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

      {!isOpen && isComplete && summary && <div className="py-4 text-(--foreground-muted) text-sm">{summary}</div>}
    </Collapsible>
  )
}

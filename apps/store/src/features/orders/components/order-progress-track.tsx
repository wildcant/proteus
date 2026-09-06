import { cn } from '@proteus/ui'
import type { StoreOrderResponseOrder } from '#/api/generated/model'
import { orderProgress, type ProgressStep } from '#/features/orders/utils/order-progress'

/**
 * How far along the order is, under the number that identifies it.
 *
 * In the header rather than in a panel of its own: a panel spans the grid, and one word plus a
 * rule does not fill a band that wide — it reads as an empty panel with a heading in it. This is
 * also where the status already was, as the second half of the "Placed …" line, so the page's
 * shape is unchanged and only the resolution of that one line has gone up.
 *
 * Still a line and not a badge, so it agrees with the account list, which renders the same
 * phrase in muted text.
 *
 * Segments rather than dots and connectors: at four steps a dot row spends most of its width on
 * the rules between the dots, and the rule is the part that carries no information.
 */
export function OrderProgressTrack({ order, className }: { order: StoreOrderResponseOrder; className?: string }) {
  const progress = orderProgress(order)

  if (progress.kind === 'stopped') {
    return (
      <div className={cn('max-w-140', className)}>
        <p className="font-medium text-ink text-sm">{progress.label}</p>
        <p className="mt-1 text-ink-muted text-sm">{progress.detail}</p>
      </div>
    )
  }

  return (
    <ol className={cn('m-0 flex max-w-200 list-none gap-2 p-0', className)} aria-label="Order progress">
      {progress.steps.map((step) => (
        <Step key={step.label} step={step} />
      ))}
    </ol>
  )
}

/**
 * The label is `sr-only` below `sm` rather than `hidden`: four labels do not fit on a phone, but
 * dropping them from the DOM would leave a screen reader four unnamed list items. The current
 * step keeps its label at every width, so the phone still says where the order is in words.
 */
function Step({ step }: { step: ProgressStep }) {
  const reached = step.state !== 'upcoming'

  return (
    <li className="flex flex-1 flex-col gap-2" aria-current={step.state === 'current' ? 'step' : undefined}>
      <span className={cn('h-0.5 w-full', reached ? 'bg-ink' : 'bg-line')} />
      <span
        className={cn(
          'text-xs',
          step.state === 'current' ? 'font-medium text-ink' : 'sr-only sm:not-sr-only',
          step.state === 'done' && 'text-ink-muted',
          step.state === 'upcoming' && 'text-ink-subtle',
        )}
      >
        {step.label}
      </span>
    </li>
  )
}

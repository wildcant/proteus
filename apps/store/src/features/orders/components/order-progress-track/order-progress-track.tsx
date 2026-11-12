import { useLingui } from '@lingui/react/macro'
import { cn } from '@proteus/ui-core'
import type { StoreOrderResponseOrder } from '#/api/generated/model'
import {
  orderProgressTrack,
  orderProgressTrackStep,
} from '#/features/orders/components/order-progress-track/order-progress-track.variants'
import { Step } from '#/features/orders/components/step/step'
import { orderProgress } from '#/features/orders/utils/order-progress'

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
  const { t } = useLingui()
  const progress = orderProgress(order)

  if (progress.kind === 'stopped') {
    return (
      // Not drawn (no seeded order is canceled): a stopped order reads as two lines, not a track.
      <div className={cn(className, 'max-w-140 flex-col')}>
        <p className="font-medium text-ink text-sm">{t(progress.label)}</p>
        <p className="mt-1 text-ink-muted text-sm">{t(progress.detail)}</p>
      </div>
    )
  }

  return (
    <ol className={cn(orderProgressTrack(), className)} aria-label={t`Order progress`}>
      {progress.steps.map((step) => (
        <Step key={step.label.id} step={step} className={orderProgressTrackStep()} />
      ))}
    </ol>
  )
}

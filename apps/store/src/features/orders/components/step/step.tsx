import { useLingui } from '@lingui/react/macro'
import { cn } from '@proteus/ui-core'
import { stepBar, stepLabel, step as stepRoot } from '#/features/orders/components/step/step.variants'
import type { ProgressStep } from '#/features/orders/utils/order-progress'

/**
 * One segment of the order's progress: a rule, and its label under it.
 *
 * The design hides the other steps' labels below `sm`; here they are `sr-only` instead, because
 * four labels do not fit on a phone, but dropping them from the DOM would leave a screen reader
 * four unnamed list items. `block` undoes the drawn `hidden` so `sr-only` can take its place.
 */
export function Step({ step, className }: { step: ProgressStep; className?: string }) {
  const { t } = useLingui()
  const { state } = step

  return (
    <li className={cn(stepRoot(), className)} aria-current={state === 'current' ? 'step' : undefined}>
      <span className={stepBar({ state })} />
      <span className={cn(stepLabel({ state }), state !== 'current' && 'sr-only block sm:not-sr-only')}>
        {t(step.label)}
      </span>
    </li>
  )
}

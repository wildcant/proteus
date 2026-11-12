import { useLingui } from '@lingui/react/macro'
import { cn } from '@proteus/ui-core'
import { Loader2Icon, MinusIcon, PlusIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import {
  quantityStepper,
  quantityStepperCount,
  quantityStepperDecrement,
  quantityStepperDecrementIcon,
  quantityStepperIncrement,
  quantityStepperIncrementIcon,
  quantityStepperValue,
} from '#/components/ui/quantity-stepper/quantity-stepper.variants'

/**
 * `xs` is the cart panel's: bare, because there the control is the only thing on its side of the row
 * and a frame would draw a border around nothing but itself. `lg` is the PDP's: boxed, so it reads as
 * one field beside the 52px add button. The frame always pairs with the size, so it is not a prop.
 */
type QuantityStepperSize = 'xs' | 'lg'

type QuantityStepperProps = {
  value: number
  onChange: (next: number) => void
  min: number
  max: number
  /** Names both buttons for assistive tech, e.g. `Decrease quantity for Sport Shorts`. */
  label: string
  disabled?: boolean
  /**
   * Makes the decrement destructive at `min` rather than merely disabled. The panel's row has no
   * separate trash — the stepper is the only affordance — so this is where removing lives. The
   * PDP passes nothing and keeps the plain disabled decrement.
   */
  onRemove?: () => void
  /** Swaps the minus for a spinner while the removal is in flight. */
  isRemoving?: boolean
  size?: QuantityStepperSize
}

/**
 * The `−  N  ＋` control, shared by the PDP and the cart panel so the two cannot drift.
 *
 * The count is an `<output>`, not a `<span>`: it is a live result of the two buttons either side
 * of it, which is what makes a screen reader announce the new value on click without an
 * aria-live region of our own.
 */
export function QuantityStepper({
  value,
  onChange,
  min,
  max,
  label,
  disabled = false,
  onRemove,
  isRemoving = false,
  size = 'xs',
}: QuantityStepperProps) {
  const { t } = useLingui()
  const removesAtMin = onRemove !== undefined && value <= min

  return (
    <div className={quantityStepper({ size })}>
      <StepperButton
        // Announced as destructive because it is: at the minimum the decrement empties the row.
        label={removesAtMin ? t`Remove ${label}` : t`Decrease quantity for ${label}`}
        disabled={disabled || (!removesAtMin && value <= min)}
        onClick={() => (removesAtMin ? onRemove() : onChange(value - 1))}
        className={quantityStepperDecrement({ size })}
      >
        <DecrementIcon isRemoving={isRemoving} className={quantityStepperDecrementIcon({ size })} />
      </StepperButton>

      <output className={quantityStepperCount({ size })}>
        <span className={quantityStepperValue()}>{value}</span>
      </output>

      <StepperButton
        label={t`Increase quantity for ${label}`}
        disabled={disabled || value >= max}
        onClick={() => onChange(value + 1)}
        className={quantityStepperIncrement({ size })}
      >
        <PlusIcon className={quantityStepperIncrementIcon({ size })} />
      </StepperButton>
    </div>
  )
}

/**
 * Always a minus, never a trash.
 *
 * Swapping in a bin at the minimum meant every row of a bag holding one of each showed a delete
 * glyph, which is most of what made the panel read as unfinished. The destructive meaning lives
 * in the button's accessible name instead — `Remove {title}` — so it is still announced, and the
 * mark stays continuous as the count falls to one.
 */
function DecrementIcon({ isRemoving, className }: { isRemoving: boolean; className: string }) {
  if (isRemoving) return <Loader2Icon className={cn(className, 'animate-spin')} />
  return <MinusIcon className={className} />
}

type StepperButtonProps = {
  label: string
  disabled: boolean
  onClick: () => void
  className: string
  children: ReactNode
}

function StepperButton({ label, disabled, onClick, className, children }: StepperButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn('-outline-offset-2 focus-visible:outline focus-visible:outline-ink', className)}
    >
      {children}
    </button>
  )
}

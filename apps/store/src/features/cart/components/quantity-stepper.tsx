import { cn } from '@proteus/ui'
import { Loader2Icon, MinusIcon, PlusIcon } from 'lucide-react'
import type { ReactNode } from 'react'

type StepperSize = 'xs' | 'sm' | 'md'
type StepperVariant = 'boxed' | 'bare'

/** Tap target, and the control's visual pitch with it. The count cell is narrower than the
 *  buttons because it is a readout, not a target — an equal three-cell grid spreads the glyphs
 *  far enough apart that they stop reading as one control and start reading as three loose icons.
 *
 *  `xs` is the cart panel's size. It is smaller than the 44px the panel's other controls are held
 *  to, and that is the point: at 40px the stepper was the tallest thing on a row whose thumbnail is
 *  68px, so it stopped reading as a quantity and started reading as a second button cluster. 32px
 *  still clears WCAG 2.2's 24px minimum, and unlike the close control this one is not the only way
 *  out of anything — the row's link and the panel's own gestures are unaffected.
 *
 *  The buttons set the row height and `items-stretch` gives the count the same, so the count
 *  only needs the width. */
const cellSize: Record<StepperSize, { button: string; count: string; glyph: string }> = {
  xs: { button: 'size-8', count: 'w-6', glyph: 'size-3.5' },
  sm: { button: 'size-9', count: 'w-7', glyph: 'size-3.5' },
  md: { button: 'size-10', count: 'w-7', glyph: 'size-4' },
}

/** Hover affordance. The boxed control can fill its cell because the frame contains the fill;
 *  an unframed button painting a grey square just draws the frame back on at the worst moment. */
const hoverStyle: Record<StepperVariant, string> = {
  boxed: 'hover:bg-surface-subtle disabled:hover:bg-transparent',
  bare: 'hover:text-ink-muted disabled:hover:text-ink',
}

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
  size?: StepperSize
  /**
   * `boxed` frames the control, which is what the PDP needs to read as one field beside the
   * add button. `bare` drops the frame: in the panel the control is the only thing on its side
   * of the row, so the box was drawing a border around nothing but itself.
   */
  variant?: StepperVariant
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
  size = 'sm',
  variant = 'boxed',
}: QuantityStepperProps) {
  const removesAtMin = onRemove !== undefined && value <= min

  return (
    <div className={cn('flex items-stretch', variant === 'boxed' && 'border border-line')}>
      <StepperButton
        // Announced as destructive because it is: at the minimum the decrement empties the row.
        label={removesAtMin ? `Remove ${label}` : `Decrease quantity for ${label}`}
        disabled={disabled || (!removesAtMin && value <= min)}
        onClick={() => (removesAtMin ? onRemove() : onChange(value - 1))}
        size={size}
        variant={variant}
      >
        <DecrementIcon isRemoving={isRemoving} glyph={cellSize[size].glyph} />
      </StepperButton>

      <output className={cn('flex items-center justify-center text-ink text-sm tabular-nums', cellSize[size].count)}>
        {value}
      </output>

      <StepperButton
        label={`Increase quantity for ${label}`}
        disabled={disabled || value >= max}
        onClick={() => onChange(value + 1)}
        size={size}
        variant={variant}
      >
        <PlusIcon className={cellSize[size].glyph} />
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
function DecrementIcon({ isRemoving, glyph }: { isRemoving: boolean; glyph: string }) {
  if (isRemoving) return <Loader2Icon className={cn(glyph, 'animate-spin')} />
  return <MinusIcon className={glyph} />
}

type StepperButtonProps = {
  label: string
  disabled: boolean
  onClick: () => void
  size: StepperSize
  variant: StepperVariant
  children: ReactNode
}

function StepperButton({ label, disabled, onClick, size, variant, children }: StepperButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex items-center justify-center text-ink -outline-offset-2 focus-visible:outline focus-visible:outline-ink disabled:opacity-30',
        hoverStyle[variant],
        cellSize[size].button,
      )}
    >
      {children}
    </button>
  )
}

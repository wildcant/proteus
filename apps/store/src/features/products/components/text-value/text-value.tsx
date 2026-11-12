import { cn } from '@proteus/ui-core'
import { textValue, textValueLabel } from '#/features/products/components/text-value/text-value.variants'
import { ValueInput, type ValueProps, valueState } from '#/features/products/components/variant-picker/value-input'

/**
 * A size cell.
 *
 * The grid runs at zero gap on purpose: the 1px borders meet and the values read as one table
 * rather than as four loose buttons. Four columns at every width — the label is 12px, which is what
 * lets a seven-size run hold four columns on a 390px phone.
 */
export function TextValue({ label, className, ...input }: ValueProps) {
  const state = valueState(input)

  return (
    // `relative` keeps the hidden radio inside the cell; the label fills the pair.
    <div className={cn('relative', className)}>
      <ValueInput {...input} />
      <label
        htmlFor={input.id}
        className={cn(
          textValue({ state }),
          textValueLabel({ state }),
          'flex-1 cursor-pointer transition-colors peer-focus-visible:outline peer-focus-visible:outline-ink peer-focus-visible:-outline-offset-2 peer-disabled:cursor-not-allowed',
        )}
      >
        {label}
      </label>
    </div>
  )
}

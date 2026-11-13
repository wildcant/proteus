export type ValueProps = {
  /** The option value's own id — unique per product, so it is safe as a DOM id. */
  id: string
  /** Shared across one option's values, which is the only thing that makes them one group. */
  name: string
  label: string
  isSelected: boolean
  isAvailable: boolean
  onSelect: () => void
  /** The value's place in the caller's strip or grid. */
  className?: string
}

/**
 * The visually-hidden control.
 *
 * `sr-only` rather than a transparent overlay: `htmlFor` already makes the label a real pointer
 * target that forwards its clicks to the radio, so covering the cell buys nothing and costs the
 * label its own `:hover` — an input painted on top owns the pointer, which forces every hover rule
 * through `peer-hover` and leaves the cursor on a control nobody can see.
 *
 * It comes first and carries `peer` so the label — its next sibling — can react to it: hiding the
 * input hides the platform's own focus ring, and painting that back is the one part of a native
 * radio that does not come free. Same mechanism `components/form/input.tsx` uses for its floating
 * label.
 */
export function ValueInput({
  id,
  name,
  isSelected,
  isAvailable,
  onSelect,
  ariaLabel,
}: Omit<ValueProps, 'label' | 'className'> & { ariaLabel?: string }) {
  return (
    <input
      id={id}
      type="radio"
      name={name}
      className="peer sr-only"
      checked={isSelected}
      disabled={!isAvailable}
      onChange={onSelect}
      aria-label={ariaLabel}
    />
  )
}

/** The drawn state of a value: chosen, out of reach, or neither. */
export const valueState = ({ isSelected, isAvailable }: Pick<ValueProps, 'isSelected' | 'isAvailable'>) => {
  if (isSelected) return 'selected'
  if (!isAvailable) return 'unavailable'
  return 'default'
}

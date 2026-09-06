import { Checkbox, FieldLabel } from '@proteus/ui'
import { useId } from 'react'

/**
 * Consent to keep the card, inside the card panel.
 *
 * A deliberate divergence from the layout reference, whose equivalent block sits below the whole
 * list: that one is a Shop-account signup, which is a different thing, and a save toggle under a
 * list where a non-card method is selected means nothing.
 *
 * Rendered by the selector rather than by an adapter, because consent is a fact about this
 * purchase rather than about a gateway — the checkout carries it into session creation, and the
 * server decides what a gateway can do about it.
 */
export function SaveMethodConsent({
  checked,
  onCheckedChange,
}: {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  const id = useId()

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-3">
        <Checkbox id={id} checked={checked} onCheckedChange={onCheckedChange} />
        <FieldLabel htmlFor={id} className="cursor-pointer font-medium text-ink text-sm">
          Save this card for next time
        </FieldLabel>
      </div>
      <p className="m-0 pl-7 text-ink-muted text-xs">
        {checked
          ? 'Stored with your account so your next checkout is one tap. Remove it whenever you like.'
          : "We'll charge it once and won't store the details."}
      </p>
    </div>
  )
}

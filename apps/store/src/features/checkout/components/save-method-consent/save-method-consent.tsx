import { Trans } from '@lingui/react/macro'
import { cn } from '@proteus/ui-core'
import { useId } from 'react'
import { Checkbox } from '#/components/ui/checkbox/checkbox'
import {
  saveMethodConsent,
  saveMethodConsentCheckbox,
  saveMethodConsentHint,
  saveMethodConsentHintText,
  saveMethodConsentLabel,
  saveMethodConsentRow,
} from '#/features/checkout/components/save-method-consent/save-method-consent.variants'

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
    <div className={saveMethodConsent()}>
      <div className={saveMethodConsentRow()}>
        <Checkbox id={id} checked={checked} onCheckedChange={onCheckedChange} className={saveMethodConsentCheckbox()} />
        {/* A plain label rather than `FieldLabel`: the set draws the label in `type/label`, and
            `FieldLabel`'s own `type/label-snug` would set its line height instead. */}
        <label htmlFor={id} className={cn(saveMethodConsentLabel(), 'cursor-pointer select-none')}>
          <Trans>Save this card for next time</Trans>
        </label>
      </div>
      <div className={saveMethodConsentHint()}>
        <p className={saveMethodConsentHintText()}>
          {checked ? (
            <Trans>Stored with your account so your next checkout is one tap. Remove it whenever you like.</Trans>
          ) : (
            <Trans>We'll charge it once and won't store the details.</Trans>
          )}
        </p>
      </div>
    </div>
  )
}

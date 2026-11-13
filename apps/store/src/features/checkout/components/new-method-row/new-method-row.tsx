import { Trans, useLingui } from '@lingui/react/macro'
import { cn } from '@proteus/ui-core'
import { useId } from 'react'
import { PaymentRow } from '#/components/store/payment-row/payment-row'
import { paymentRowContent } from '#/components/store/payment-row/payment-row.variants'
import { FieldLabel } from '#/components/ui/field-label/field-label'
import { RadioGroupItem } from '#/components/ui/radio-group-item/radio-group-item'
import { AcceptedNetworks } from '#/entities/payment-method/ui/accepted-networks/accepted-networks'
import {
  newMethodRow,
  newMethodRowChoice,
  newMethodRowLabel,
  newMethodRowNetworks,
  newMethodRowRadio,
  newMethodRowRow,
} from '#/features/checkout/components/new-method-row/new-method-row.variants'

/**
 * The same row as a saved card, standing for the ones that are not saved yet.
 *
 * The accepted-network strip sits where a saved card's own mark does, which is what makes this
 * read as a member of the list rather than as a control appended to it. `value` is what the
 * selector's radio group carries for "not one of the saved cards".
 */
export function NewMethodRow({ selected, value }: { selected: boolean; value: string }) {
  const radioId = useId()
  const { t } = useLingui()

  return (
    // The row's collapse against its neighbour moves to this wrapper, as `SavedCardRow`'s does.
    <div className={cn(newMethodRow(), '-mt-px first:mt-0')}>
      <PaymentRow
        state={selected ? 'selected' : 'default'}
        data-testid="new-method-row"
        className={newMethodRowRow({ selected })}
      >
        <div className={cn(paymentRowContent(), 'min-w-0')}>
          <FieldLabel htmlFor={radioId} className={cn(newMethodRowChoice(), 'min-w-0 cursor-pointer')}>
            <RadioGroupItem
              id={radioId}
              value={value}
              aria-label={t`Use a different card`}
              className={newMethodRowRadio()}
            />
            <span className={cn(newMethodRowLabel(), 'min-w-0')}>
              <Trans>Use a different card</Trans>
            </span>
            <AcceptedNetworks className={newMethodRowNetworks()} />
          </FieldLabel>
        </div>
      </PaymentRow>
    </div>
  )
}

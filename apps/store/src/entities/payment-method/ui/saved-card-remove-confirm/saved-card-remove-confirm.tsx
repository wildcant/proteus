import { Trans, useLingui } from '@lingui/react/macro'
import { cn } from '@proteus/ui-core'
import { PaymentRow } from '#/components/store/payment-row/payment-row'
import { paymentRowContent } from '#/components/store/payment-row/payment-row.variants'
import { NetworkMark } from '#/entities/payment-method/ui/network-mark/network-mark'
import {
  savedCardRemoveConfirm,
  savedCardRemoveConfirmActions,
  savedCardRemoveConfirmConfirm,
  savedCardRemoveConfirmHint,
  savedCardRemoveConfirmKeep,
  savedCardRemoveConfirmKeepLabel,
  savedCardRemoveConfirmNetwork,
  savedCardRemoveConfirmQuestion,
  savedCardRemoveConfirmRemove,
  savedCardRemoveConfirmRemoveLabel,
  savedCardRemoveConfirmRow,
  savedCardRemoveConfirmText,
} from '#/entities/payment-method/ui/saved-card-remove-confirm/saved-card-remove-confirm.variants'

/**
 * `SavedCardRow` asking before it removes its card: a saved-card list is for paying, and a
 * one-tap destructive control beside the row you are about to select is a mis-tap waiting to
 * happen.
 */
export function SavedCardRemoveConfirm({
  brand,
  methodId,
  question,
  removing,
  onKeep,
  onRemove,
}: {
  brand: string
  methodId: string
  question: string
  removing: boolean
  onKeep: () => void
  onRemove: () => void
}) {
  const { t } = useLingui()

  return (
    // The row's collapse against its neighbour moves to this wrapper, as `SavedCardRow`'s does.
    <div className={cn(savedCardRemoveConfirm(), '-mt-px first:mt-0')}>
      <PaymentRow
        state="muted"
        data-testid="saved-card-confirm-remove"
        data-method-id={methodId}
        className={savedCardRemoveConfirmRow()}
      >
        <div className={cn(paymentRowContent(), 'min-w-0')}>
          <div className={cn(savedCardRemoveConfirmConfirm(), 'min-w-0')}>
            <NetworkMark brand={brand} className={savedCardRemoveConfirmNetwork()} />
            <span className={cn(savedCardRemoveConfirmText(), 'min-w-0')}>
              <span className={savedCardRemoveConfirmQuestion()}>{question}</span>
              <span className={savedCardRemoveConfirmHint()}>
                <Trans>You'll need to enter it again next time.</Trans>
              </span>
            </span>
            <span className={cn(savedCardRemoveConfirmActions(), 'shrink-0')}>
              {/* `outline-none`: the drawn focus ring replaces the browser's outline. */}
              <button
                type="button"
                className={cn(savedCardRemoveConfirmKeep(), 'outline-none')}
                onClick={onKeep}
                disabled={removing}
              >
                <span className={savedCardRemoveConfirmKeepLabel()}>
                  <Trans>Keep</Trans>
                </span>
              </button>
              <button
                type="button"
                className={cn(savedCardRemoveConfirmRemove(), 'outline-none')}
                onClick={onRemove}
                disabled={removing}
              >
                <span className={savedCardRemoveConfirmRemoveLabel()}>{removing ? t`Removing…` : t`Remove`}</span>
              </button>
            </span>
          </div>
        </div>
      </PaymentRow>
    </div>
  )
}

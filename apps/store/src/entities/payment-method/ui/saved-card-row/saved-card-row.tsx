import { Trans, useLingui } from '@lingui/react/macro'
import { cn } from '@proteus/ui-core'
import { useId, useState } from 'react'
import type { StoreSavedMethod } from '#/api/generated/model'
import { PaymentRow } from '#/components/store/payment-row/payment-row'
import { paymentRowContent } from '#/components/store/payment-row/payment-row.variants'
import { FieldLabel } from '#/components/ui/field-label/field-label'
import { Icon } from '#/components/ui/icon/icon'
import { RadioGroupItem } from '#/components/ui/radio-group-item/radio-group-item'
import { Skeleton } from '#/components/ui/skeleton/skeleton'
import { expiryStatus, formatExpiry } from '#/entities/payment-method/lib/expiry'
import { NetworkMark } from '#/entities/payment-method/ui/network-mark/network-mark'
import { SavedCardRemoveConfirm } from '#/entities/payment-method/ui/saved-card-remove-confirm/saved-card-remove-confirm'
import {
  savedCardRow,
  savedCardRowChoice,
  savedCardRowDefaultLabel,
  savedCardRowExpiry,
  savedCardRowIcon,
  savedCardRowNetwork,
  savedCardRowNumber,
  savedCardRowRadioGroupItem,
  savedCardRowRemove,
  savedCardRowRow,
  savedCardRowText,
  savedCardRowTrash,
} from '#/entities/payment-method/ui/saved-card-row/saved-card-row.variants'
import { savedMethodName } from '#/lib/card-networks'

/**
 * One stored card, rendered by one component wherever a stored card appears.
 *
 * The checkout selector and `/account/payment-methods` both go through this: two lists of cards
 * that could disagree about what a shopper owns is the failure mode extracting it prevents. The
 * surfaces differ only in what their radio group decides — "pay with this" at checkout, "make
 * this the default" in the account — and the group owns that, not the row.
 *
 * Nothing here sorts or filters. Ordering is the backend's, applied once, so neither surface can
 * hold a second opinion about it.
 */
export type SavedCardRowProps = {
  method: StoreSavedMethod
  /** Whether the surface's radio sits on this row. Styling only — the group owns the control. */
  checked: boolean
  /** What choosing this row means here. The radio's accessible name, so the two surfaces differ. */
  chooseLabel: string
  /**
   * Detaches the card and settles the surface's own state. The row stays mounted until it
   * resolves, and a rejection puts the row back with a retryable message — a removal that failed
   * at the gateway must not look like one that worked.
   */
  onRemove: () => Promise<void>
}

export function SavedCardRow({ method, checked, chooseLabel, onRemove }: SavedCardRowProps) {
  const { t } = useLingui()
  const radioId = useId()
  const [confirming, setConfirming] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [failed, setFailed] = useState(false)

  const status = expiryStatus(method)
  const expired = status === 'expired'
  const name = savedMethodName(method)

  const confirmRemove = async () => {
    setRemoving(true)
    setFailed(false)
    try {
      await onRemove()
    } catch {
      // The row survives, because the card did. Reopening the prompt on a failure would hide
      // that this attempt did not happen.
      setRemoving(false)
      setConfirming(false)
      setFailed(true)
    }
  }

  if (confirming) {
    return (
      <SavedCardRemoveConfirm
        brand={method.brand}
        methodId={method.id}
        question={t`Remove ${name}?`}
        removing={removing}
        onKeep={() => setConfirming(false)}
        onRemove={confirmRemove}
      />
    )
  }

  return (
    // The row's collapse against its neighbour moves to this wrapper: inside it the PaymentRow is
    // always a first child, so its own `-mt-px first:mt-0` no longer sees the list.
    <div className={cn(savedCardRow(), '-mt-px first:mt-0')}>
      <PaymentRow
        // An expired card does not wear the selection envelope even when it is the shopper's default
        // and its radio is honestly checked: the envelope says "this is what you are paying with",
        // and a struck-through row wearing it reads as a card about to be charged.
        state={expired ? 'muted' : checked ? 'selected' : 'default'}
        data-testid="saved-card-row"
        data-method-id={method.id}
        className={savedCardRowRow()}
      >
        <div className={cn(paymentRowContent(), 'min-w-0')}>
          {/*
        The selectable area is a <label>; Remove is its *sibling*. A button nested inside a label
        fires the label's control on every click, so a shopper trying to remove a card would
        select it instead — and at checkout, select it and then remove it.
      */}
          <FieldLabel
            htmlFor={radioId}
            className={cn(savedCardRowChoice(), 'min-w-0', expired ? 'cursor-not-allowed' : 'cursor-pointer')}
          >
            <RadioGroupItem
              id={radioId}
              value={method.id}
              disabled={expired}
              aria-label={chooseLabel}
              className={savedCardRowRadioGroupItem()}
            />
            <NetworkMark brand={method.brand} className={savedCardRowNetwork()} />
            <span className={cn(savedCardRowText(), 'min-w-0')}>
              <span className={cn(savedCardRowNumber(), 'tabular-nums', expired && 'text-ink-muted line-through')}>
                {`•••• ${method.last4}`}
              </span>
              {!!method.isDefault && (
                <span className={savedCardRowDefaultLabel()}>
                  <Trans>Default</Trans>
                </span>
              )}
              {!!expired && (
                <span className="text-ink-muted text-xs">
                  <Trans>
                    <strong className="font-semibold">Expired</strong> — add this card again to use it
                  </Trans>
                </span>
              )}
              {status === 'expiring' && (
                <span className="text-ink-muted text-xs">
                  <strong className="font-semibold text-ink">
                    <Trans>Expires this month</Trans>
                  </strong>
                </span>
              )}
              {!!failed && (
                <span className="text-sale text-xs">
                  <Trans>
                    <strong className="font-semibold">Couldn't remove that card.</strong> Try again.
                  </Trans>
                </span>
              )}
            </span>
            {!expired && (
              <span className={cn(savedCardRowExpiry(), 'shrink-0 tabular-nums')}>{formatExpiry(method)}</span>
            )}
          </FieldLabel>
          <button
            type="button"
            aria-label={t`Remove ${name}`}
            onClick={() => setConfirming(true)}
            // `-mr-2` pulls the 32px hit area into the row's padding, which a drawing can't hold.
            className={cn(
              savedCardRowRemove(),
              savedCardRowTrash(),
              '-mr-2 shrink-0 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink',
            )}
          >
            <Icon name="trash-2" className={savedCardRowIcon()} />
          </button>
        </div>
      </PaymentRow>
    </div>
  )
}

/**
 * What the wallet looks like while it is being read, on both surfaces that read one.
 *
 * It lives beside the row for the same reason the row lives here at all: it stands in for
 * `SavedCardRow`, and a placeholder written separately from the row drifts from it. It had —
 * twice, verbatim, once per surface — and both copies froze the row at a flat `h-15` while the
 * row itself is content plus `p-4`, so the list jumped when the cards arrived.
 *
 * So the envelope *is* `PaymentRow` and there is no height figure here: the row comes out at its
 * tallest child plus `p-4`, which is the rule a real row measures by.
 *
 * Which makes *which child is tallest* the whole of getting this right, and it is not the network
 * mark. Remove is a **sibling** of `FieldLabel` rather than something inside it — see the comment
 * on the row above — so it is a direct child of this same flex box, and at `size-8` it stands 8px
 * over the `h-6` mark buried in the label. A placeholder that stands in for the mark and the text
 * but not the button is 8px short of every row it replaces, which is the whole reason the third
 * shape is here. All three, and a single-line row and a placeholder row both measure 66.
 *
 * `aria-hidden` because a placeholder names nothing, and two announced empty rows are worse than
 * the silence before the list arrives.
 */
export function WalletSkeleton() {
  return (
    <div className="flex flex-col" data-testid="wallet-skeleton" aria-hidden="true">
      {Array.from({ length: 2 }, (_, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: placeholder rows have no identity
        <PaymentRow key={index}>
          <Skeleton className="h-6 w-10 shrink-0" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="ml-auto size-8 shrink-0" />
        </PaymentRow>
      ))}
    </div>
  )
}

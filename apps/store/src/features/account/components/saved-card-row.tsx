import { cn, FieldLabel, RadioGroupItem } from '@proteus/ui'
import { Trash2Icon } from 'lucide-react'
import { useId, useState } from 'react'
import type { StoreSavedMethod } from '#/api/generated/model'
import { NetworkMark } from '#/components/payment-network'
import { expiryStatus, formatExpiry } from '../payment-methods/expiry'
import { ROW_CLASS, ROW_LABEL_CLASS, ROW_SELECTED_CLASS, savedMethodName } from '../payment-methods/row'

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

  // A two-step confirmation, inline: a saved-card list is for paying, and a one-tap destructive
  // control beside the row you are about to select is a mis-tap waiting to happen.
  if (confirming) {
    return (
      <div
        className={cn(ROW_CLASS, 'bg-surface-subtle')}
        data-testid="saved-card-confirm-remove"
        data-method-id={method.id}
      >
        <NetworkMark brand={method.brand} />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="font-medium text-ink text-sm">{`Remove ${name}?`}</span>
          <span className="text-ink-muted text-xs">You'll need to enter it again next time.</span>
        </span>
        <span className="flex shrink-0 items-center gap-1">
          <button type="button" className={TEXT_BUTTON_CLASS} onClick={() => setConfirming(false)} disabled={removing}>
            Keep
          </button>
          <button
            type="button"
            className={cn(TEXT_BUTTON_CLASS, 'border-ink text-ink hover:bg-ink hover:text-surface')}
            onClick={confirmRemove}
            disabled={removing}
          >
            {removing ? 'Removing…' : 'Remove'}
          </button>
        </span>
      </div>
    )
  }

  return (
    <div
      // An expired card does not wear the selection envelope even when it is the shopper's default
      // and its radio is honestly checked: the envelope says "this is what you are paying with",
      // and a struck-through row wearing it reads as a card about to be charged.
      className={cn(ROW_CLASS, checked && !expired && ROW_SELECTED_CLASS, expired && 'bg-surface-subtle')}
      data-testid="saved-card-row"
      data-method-id={method.id}
    >
      {/*
        The selectable area is a <label>; Remove is its *sibling*. A button nested inside a label
        fires the label's control on every click, so a shopper trying to remove a card would
        select it instead — and at checkout, select it and then remove it.
      */}
      <FieldLabel htmlFor={radioId} className={cn(ROW_LABEL_CLASS, expired ? 'cursor-not-allowed' : 'cursor-pointer')}>
        <RadioGroupItem id={radioId} value={method.id} disabled={expired} aria-label={chooseLabel} />
        <NetworkMark brand={method.brand} />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span
            className={cn('font-medium text-sm tabular-nums', expired ? 'text-ink-muted line-through' : 'text-ink')}
          >
            {`•••• ${method.last4}`}
          </span>
          {!!method.isDefault && <span className="text-ink-muted text-xs">Default</span>}
          {!!expired && (
            <span className="text-ink-muted text-xs">
              <strong className="font-semibold">Expired</strong> — add this card again to use it
            </span>
          )}
          {status === 'expiring' && (
            <span className="text-ink-muted text-xs">
              <strong className="font-semibold text-ink">Expires this month</strong>
            </span>
          )}
          {!!failed && (
            <span className="text-sale text-xs">
              <strong className="font-semibold">Couldn't remove that card.</strong> Try again.
            </span>
          )}
        </span>
        {!expired && <span className="shrink-0 text-ink-muted text-xs tabular-nums">{formatExpiry(method)}</span>}
      </FieldLabel>
      <button
        type="button"
        aria-label={`Remove ${name}`}
        onClick={() => setConfirming(true)}
        className="-mr-2 flex size-8 shrink-0 items-center justify-center text-ink-muted hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink"
      >
        <Trash2Icon className="size-4" />
      </button>
    </div>
  )
}

/** Quiet text actions, square and borderless until they matter. */
const TEXT_BUTTON_CLASS =
  'border border-transparent px-2.5 py-1.5 font-medium text-ink-muted text-xs hover:text-ink disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink'

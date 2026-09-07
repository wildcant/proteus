import { cn, FieldLabel, RadioGroupItem, Skeleton } from '@proteus/ui'
import { Trash2Icon } from 'lucide-react'
import { useId, useState } from 'react'
import type { StoreSavedMethod } from '#/api/generated/model'
import { NetworkMark } from '#/components/payment-network'
import { PaymentRow, paymentRowLabelVariants } from '#/components/payment-row'
import { savedMethodName } from '#/lib/card-networks'
import { expiryStatus, formatExpiry } from '../utils/expiry'

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
      <PaymentRow state="muted" data-testid="saved-card-confirm-remove" data-method-id={method.id}>
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
      </PaymentRow>
    )
  }

  return (
    <PaymentRow
      // An expired card does not wear the selection envelope even when it is the shopper's default
      // and its radio is honestly checked: the envelope says "this is what you are paying with",
      // and a struck-through row wearing it reads as a card about to be charged.
      state={expired ? 'muted' : checked ? 'selected' : 'default'}
      data-testid="saved-card-row"
      data-method-id={method.id}
    >
      {/*
        The selectable area is a <label>; Remove is its *sibling*. A button nested inside a label
        fires the label's control on every click, so a shopper trying to remove a card would
        select it instead — and at checkout, select it and then remove it.
      */}
      <FieldLabel htmlFor={radioId} className={paymentRowLabelVariants({ interactive: !expired })}>
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
    </PaymentRow>
  )
}

/** Quiet text actions, square and borderless until they matter. */
const TEXT_BUTTON_CLASS =
  'border border-transparent px-2.5 py-1.5 font-medium text-ink-muted text-xs hover:text-ink disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink'

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

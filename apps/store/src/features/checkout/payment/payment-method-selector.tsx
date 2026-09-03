import { cn, FieldLabel, RadioGroup, RadioGroupItem, Skeleton } from '@proteus/ui'
import { type ReactNode, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { AcceptedNetworks } from '#/components/payment-network'
import { SavedCardRow } from '#/features/account/components/saved-card-row'
import { isUsable } from '#/features/account/payment-methods/expiry'
import { ROW_CLASS, ROW_LABEL_CLASS, ROW_SELECTED_CLASS, savedMethodName } from '#/features/account/payment-methods/row'
import { usePaymentControllerContext } from './payment-controller'
import { SaveMethodConsent } from './save-method-consent'
import type { PaymentAdapterContext, StorePaymentAdapter } from './types'

/**
 * The provider-neutral payment method selector.
 *
 * Three renders, one component:
 *
 * - **Loading** — skeleton rows. The wallet is a gateway round trip, and a payment step that snaps
 *   from a card form into a list of cards has moved the button the shopper was reaching for.
 * - **Empty** — a guest, an account with nothing saved, or an account whose only stored method is
 *   not a card (the backend drops those before anything counts them). The adapter's form is the
 *   whole step, with no radio group: a one-option radio group invents a choice that does not exist.
 * - **Populated** — the saved cards, then a "use a different card" row that opens the form.
 *
 * The list is flat, and the panel that opens is the row above it continued rather than a box
 * inside it. The rows inside that panel are the Payment Element's own accordion, drawn in a
 * cross-origin iframe no stylesheet of ours can reach — `appearance.ts` writes `.AccordionItem` as
 * this file's twin so the seam does not show.
 */
type PaymentMethodSelectorProps = {
  adapter: StorePaymentAdapter
  context: PaymentAdapterContext
}

export function PaymentMethodSelector({ adapter, context }: PaymentMethodSelectorProps) {
  // Gated on the session, never on a wallet count: a logged-in shopper with nothing saved is
  // precisely the one saving their first card. This is a real bug in the reference implementation
  // that the spec calls out by name.
  const canSaveMethod = context.customer?.hasAccount === true
  const { savedMethods } = adapter

  return (
    <adapter.Root context={context}>
      <RegisterConfirm adapter={adapter} />
      {savedMethods ? (
        <Wallet adapter={adapter} savedMethods={savedMethods} canSaveMethod={canSaveMethod} />
      ) : (
        // A gateway with no wallet gets the empty render, which is the correct one for it: there
        // is nothing to list, and nothing to consent to keeping. `savedMethods` is optional on the
        // port in exactly the way `IPaymentProvider`'s method operations are.
        <NewMethodPanel adapter={adapter} canSaveMethod={false} continuesSelection={false} />
      )}
    </adapter.Root>
  )
}

type WalletProps = {
  adapter: StorePaymentAdapter
  savedMethods: NonNullable<StorePaymentAdapter['savedMethods']>
  canSaveMethod: boolean
}

function Wallet({ adapter, savedMethods, canSaveMethod }: WalletProps) {
  const { methods, isLoading, failed, refetch, remove } = savedMethods.useWallet()
  const { registerWallet } = usePaymentControllerContext()

  /** `null` is the new-method form, which is where every shopper starts before auto-selection. */
  const [chosen, setChosen] = useState<string | null>(null)
  const [saveMethod, setSaveMethod] = useState(false)
  const [staleNotice, setStaleNotice] = useState(false)
  /** Rows dropped by a completed detach, so nothing brings one back before the refetch lands. */
  const [removed, setRemoved] = useState<readonly string[]>([])
  const autoSelected = useRef(false)

  const visible = useMemo(() => methods.filter((method) => !removed.includes(method.id)), [methods, removed])

  /**
   * Land a returning shopper on a card they can actually use — **once**.
   *
   * The `autoSelected` ref is the whole of it, and it is a guard rather than a dependency list: a
   * later refetch must not move a selection the shopper made, and every refetch this component can
   * cause happens after they have had the chance to make one. Ported from the reference
   * implementation along with the behaviour, because the behaviour without the guard is a
   * different feature.
   *
   * The default first, then the first usable card — in that order rather than "the first row",
   * because a shopper whose default has expired still has a default and it is not the answer.
   */
  useEffect(() => {
    if (autoSelected.current || isLoading || visible.length === 0) return
    autoSelected.current = true

    const preferred =
      visible.find((method) => method.isDefault && isUsable(method)) ?? visible.find((method) => isUsable(method))
    if (preferred) setChosen(preferred.id)
  }, [isLoading, visible])

  /**
   * The shopper's selection, reconciled against what the wallet actually holds.
   *
   * A refetch can drop the chosen card for reasons this component never saw — removed in another
   * tab, detached by the gateway, expired out from under a long-open step. Without this the row
   * simply disappears and `chosen` keeps pointing at it, which leaves a payment step with nothing
   * checked, no card form, and a dead id on its way to Place order.
   *
   * Separate from `dropRow` on purpose: that handles the removal this component performed, and
   * this handles every other way the card can leave.
   */
  useEffect(() => {
    if (isLoading || chosen === null || visible.some((method) => method.id === chosen)) return
    setChosen(visible.find((method) => isUsable(method))?.id ?? null)
  }, [isLoading, visible, chosen])

  /**
   * The chosen card is gone at the gateway. Refetch, and put the shopper on a new card rather than
   * letting them press Place order on the same dead id.
   *
   * `autoSelected` is already true by now, so the refetch cannot quietly move them onto some other
   * card on the way back.
   *
   * `removed` is cleared only once the refetch has landed. Clearing it first recomputes the visible
   * list from a cache that still holds every card removed this session — so the shopper would watch
   * their removed cards reappear under a notice telling them a card is no longer available.
   */
  const resetForStaleMethod = useCallback(() => {
    setChosen(null)
    setStaleNotice(true)
    void refetch().finally(() => setRemoved([]))
  }, [refetch])

  useEffect(() => {
    registerWallet({ chosenMethodId: chosen, saveMethod, resetForStaleMethod })
    // Unregistering on unmount is what makes a provider switch safe: the button would otherwise
    // place the order against a card chosen in an adapter the shopper has navigated away from.
    return () => registerWallet(null)
  }, [chosen, saveMethod, resetForStaleMethod, registerWallet])

  /**
   * Optimistic against a *completed* detach: the card is already gone at the gateway by the time
   * this runs, so dropping the row beats waiting on a refetch and reflowing the list under the
   * shopper's cursor. If they were paying with it, move them to the next card they can use.
   *
   * `remove` has already written the card out of the shared cache by now, so this is belt to that
   * braces — it also covers a refetch that was in flight before the detach landed.
   */
  const dropRow = (methodId: string) => {
    setRemoved((previous) => [...previous, methodId])
    if (chosen !== methodId) return

    const next = visible.find((method) => method.id !== methodId && isUsable(method))
    setChosen(next?.id ?? null)
  }

  const consent = canSaveMethod ? <SaveMethodConsent checked={saveMethod} onCheckedChange={setSaveMethod} /> : null

  if (isLoading) return <WalletSkeleton />

  // A guest, an empty wallet, or a wallet we could not read. All three are the adapter's form on
  // its own — a failed load is not fatal, because a shopper who cannot see their saved cards can
  // still pay.
  if (visible.length === 0) {
    return (
      <>
        {!!failed && <SelectorNotice>We couldn't load your saved cards. Enter a card below to pay.</SelectorNotice>}
        {!!staleNotice && <SelectorNotice>{STALE_METHOD_NOTICE}</SelectorNotice>}
        <NewMethodPanel adapter={adapter} canSaveMethod={canSaveMethod} continuesSelection={false}>
          {consent}
        </NewMethodPanel>
      </>
    )
  }

  const usingNewMethod = chosen === null

  return (
    <>
      {!!staleNotice && <SelectorNotice>{STALE_METHOD_NOTICE}</SelectorNotice>}
      <RadioGroup
        aria-label="Payment method"
        className="gap-0"
        value={chosen ?? NEW_METHOD_VALUE}
        onValueChange={(value) => {
          setStaleNotice(false)
          setChosen(String(value) === NEW_METHOD_VALUE ? null : String(value))
        }}
      >
        {visible.map((method) => (
          <SavedCardRow
            key={method.id}
            method={method}
            checked={method.id === chosen}
            chooseLabel={`Pay with ${savedMethodName(method)}`}
            onRemove={() => remove(method.id).then(() => dropRow(method.id))}
          />
        ))}

        <NewMethodRow selected={usingNewMethod} />
      </RadioGroup>

      {!!usingNewMethod && (
        <NewMethodPanel adapter={adapter} canSaveMethod={canSaveMethod} continuesSelection>
          {consent}
        </NewMethodPanel>
      )}
    </>
  )
}

/** The value the group carries for "not one of the saved cards". */
const NEW_METHOD_VALUE = 'new-method'

const STALE_METHOD_NOTICE = 'That saved card is no longer available. Pick another, or enter a new card below.'

/**
 * Row 2: the same row as a saved card, standing for the ones that are not saved yet.
 *
 * The accepted-network strip sits where a saved card's own mark does, which is what makes this
 * read as a member of the list rather than as a control appended to it.
 */
function NewMethodRow({ selected }: { selected: boolean }) {
  const radioId = useId()

  return (
    // The same envelope-plus-label structure a saved card row uses, rather than `ROW_CLASS` on the
    // label itself: `FieldLabel` ships `w-fit`, so a row built that way stops at its own text and
    // the network strip lands short of where every other row's right edge is.
    <div className={cn(ROW_CLASS, selected && ROW_SELECTED_CLASS)} data-testid="new-method-row">
      <FieldLabel htmlFor={radioId} className={cn(ROW_LABEL_CLASS, 'cursor-pointer')}>
        <RadioGroupItem id={radioId} value={NEW_METHOD_VALUE} aria-label="Use a different card" />
        <span className="min-w-0 flex-1 font-medium text-ink text-sm">Use a different card</span>
        <AcceptedNetworks />
      </FieldLabel>
    </div>
  )
}

/**
 * The opened panel: the gateway's own form, then the consent to keep the card.
 *
 * Always the row above it extended downwards — a fill, an inset, and no top edge, so the row and
 * the panel draw one envelope rather than two stacked boxes. That is also why the Payment
 * Element's `--selected` accordion state is deliberately left unbordered inside here.
 *
 * `continuesSelection` is which row it is continuing. The "use a different card" row is the
 * shopper's selection and carries the ink border, so the panel finishes it in ink. In the empty
 * render there is no such row — the panel hangs off the provider row, which is filled rather than
 * bordered — so a hairline is the honest edge for it.
 */
function NewMethodPanel({
  adapter,
  canSaveMethod,
  continuesSelection,
  children,
}: {
  adapter: StorePaymentAdapter
  canSaveMethod: boolean
  continuesSelection: boolean
  children?: ReactNode
}) {
  return (
    <div
      data-testid="new-method-panel"
      className={cn(
        'relative z-1 -mt-px flex flex-col gap-4 border border-t-0 bg-surface-subtle p-4',
        continuesSelection ? 'border-ink' : 'border-line',
      )}
    >
      <adapter.NewMethodForm canSaveMethod={canSaveMethod} />
      {children}
    </div>
  )
}

function SelectorNotice({ children }: { children: string }) {
  return (
    <p role="status" className="m-0 mb-3 border border-line border-l-2 border-l-ink bg-surface p-3 text-ink text-sm">
      {children}
    </p>
  )
}

function WalletSkeleton() {
  return (
    <div className="flex flex-col" data-testid="wallet-skeleton" aria-hidden="true">
      {Array.from({ length: 2 }, (_, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: placeholder rows have no identity
        <Skeleton key={index} className="-mt-px h-15 w-full first:mt-0" />
      ))}
    </div>
  )
}

/**
 * Hands the mounted adapter's confirm up to the place-order button.
 *
 * A component rather than a call in the selector because `useConfirm` must run inside the
 * adapter's `Root`, and `Root` is this component's parent rather than its caller's.
 */
function RegisterConfirm({ adapter }: Pick<PaymentMethodSelectorProps, 'adapter'>) {
  const confirm = adapter.useConfirm()
  const { register } = usePaymentControllerContext()

  useEffect(() => {
    register(confirm)
    // Unregistering on unmount is what makes a provider switch safe: the button would otherwise
    // keep confirming through the adapter the shopper just navigated away from.
    return () => register(null)
  }, [confirm, register])

  return null
}

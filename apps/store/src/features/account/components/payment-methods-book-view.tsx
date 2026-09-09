import { RadioGroup } from '@proteus/ui'
import { Link } from '@tanstack/react-router'
import { ChevronLeftIcon } from 'lucide-react'
import type { StoreSavedMethod } from '#/api/generated/model'
import { Button } from '#/components/button'
import { SavedCardRow, WalletSkeleton } from '#/features/account/components/saved-card-row'
import { isUsable } from '#/features/account/utils/expiry'
import { savedMethodName } from '#/lib/card-networks'

/**
 * The same page with the wallet as an argument rather than a round trip.
 *
 * Split out because the three states worth asserting — a wallet that would not load, a nomination
 * reaching the right card, a list of only expired cards — are render logic, and reaching them
 * through the query would mean faking our own API. With the wallet as a prop they are a component
 * test (`payment-methods-book-view.browser.test.tsx`); the container above is then four lines with
 * nothing left in it to get wrong.
 */
export type PaymentMethodsBookViewProps = {
  methods: readonly StoreSavedMethod[]
  isLoading: boolean
  /** Told apart from an empty wallet: see `WalletUnavailable`. */
  failed: boolean
  onRetry: () => void
  onSetDefault: (methodId: string) => void
  onRemove: (methodId: string) => Promise<void>
}

export function PaymentMethodsBookView({
  methods,
  isLoading,
  failed,
  onRetry,
  onSetDefault,
  onRemove,
}: PaymentMethodsBookViewProps) {
  const defaultMethod = methods.find((method) => method.isDefault)

  return (
    <main className="mx-auto w-full max-w-350 px-4 pt-8 pb-16 sm:px-6 lg:px-8">
      <Button variant="link" render={<Link to="/account" />} className="gap-1 text-ink-muted">
        <ChevronLeftIcon className="size-4" />
        Back to account
      </Button>
      <h1 className="type-display mt-4 text-ink">Payment methods</h1>

      <div className="mt-10 max-w-160">
        {isLoading ? (
          <WalletSkeleton />
        ) : failed ? (
          <WalletUnavailable onRetry={onRetry} />
        ) : methods.length === 0 ? (
          <WalletEmpty />
        ) : (
          <>
            <h2 className="type-heading text-ink">Your cards</h2>
            <p className="mt-3 text-ink-muted text-sm">
              Your default card is the one your next checkout starts on. Cards are saved by paying with them.
            </p>
            {/* One group for the whole list: exactly one card can be the default, and the route
                answers with the reordered wallet in the same round trip. */}
            <RadioGroup
              className="mt-6 gap-0"
              value={defaultMethod?.id ?? ''}
              onValueChange={(methodId) => onSetDefault(String(methodId))}
            >
              {methods.map((method) => (
                <SavedCardRow
                  key={method.id}
                  method={method}
                  checked={method.id === defaultMethod?.id}
                  chooseLabel={
                    method.isDefault
                      ? `${savedMethodName(method)}, your default card`
                      : `Make ${savedMethodName(method)} the default`
                  }
                  onRemove={() => onRemove(method.id)}
                />
              ))}
            </RadioGroup>
            {methods.every((method) => !isUsable(method)) && (
              <p className="mt-4 text-ink-muted text-sm">
                Every card here has expired. Pay with a new card at checkout to save a usable one.
              </p>
            )}
          </>
        )}
      </div>
    </main>
  )
}

/** Two lines of type and a way out, the same shape the address book's empty state uses. */
function WalletEmpty() {
  return (
    <div>
      <h2 className="type-heading text-ink">No saved cards</h2>
      <p className="mt-3 max-w-90 text-ink-muted text-sm">
        Cards are saved at checkout — choose "Save this card for next time" when you pay and it will be here for your
        next order.
      </p>
      <Button render={<Link to="/" />} className="mt-6">
        Start shopping
      </Button>
    </div>
  )
}

/**
 * A wallet we could not read, told apart from an empty one.
 *
 * The distinction matters to the shopper: an empty wallet is a fact about them and a failed read
 * is a fact about us, and answering the second with "no saved cards" invites them to go and save
 * a card they already have.
 */
function WalletUnavailable({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" className="border border-line border-l-2 border-l-ink bg-surface-subtle p-4">
      <p className="m-0 text-ink text-sm">We couldn't load your saved cards.</p>
      <Button variant="link" className="mt-2" onClick={onRetry}>
        Try again
      </Button>
    </div>
  )
}

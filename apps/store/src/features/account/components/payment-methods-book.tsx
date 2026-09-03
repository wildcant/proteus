import { RadioGroup } from '@proteus/ui'
import { Link } from '@tanstack/react-router'
import { ChevronLeftIcon } from 'lucide-react'
import { Button } from '#/components/button'
import {
  usePaymentMethods,
  useRemovePaymentMethod,
  useSetDefaultPaymentMethod,
} from '#/features/account/api/payment-methods'
import { SavedCardRow, WalletSkeleton } from '#/features/account/components/saved-card-row'
import { isUsable } from '#/features/account/payment-methods/expiry'
import { savedMethodName } from '#/features/account/payment-methods/row'

/**
 * The account wallet.
 *
 * List, remove, nominate a default — and deliberately no way to add a card. Adding one outside a
 * purchase means a SetupIntent flow, which is its own feature; here a card is saved by paying
 * with it, which is what the empty state says rather than leaving the shopper looking for a
 * button that does not exist.
 *
 * The rows are the checkout selector's rows, and the order is the backend's. Neither is a
 * coincidence: a shopper whose account page and checkout disagree about their cards has been
 * given two wallets.
 */
export function PaymentMethodsBook() {
  const { methods, isLoading, failed, refetch } = usePaymentMethods()
  const removeMethod = useRemovePaymentMethod()
  const setDefault = useSetDefaultPaymentMethod()

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
          <WalletUnavailable onRetry={refetch} />
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
              onValueChange={(methodId) => setDefault.mutate(String(methodId))}
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
                  onRemove={() => removeMethod.mutateAsync(method.id).then(() => undefined)}
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

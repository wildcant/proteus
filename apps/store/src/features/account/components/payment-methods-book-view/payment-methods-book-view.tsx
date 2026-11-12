import { Trans, useLingui } from '@lingui/react/macro'
import { cn } from '@proteus/ui-core'
import type { StoreSavedMethod } from '#/api/generated/model'
import { BackLink } from '#/components/store/back-link/back-link'
import { RadioGroup } from '#/components/ui/radio-group/radio-group'
import { isUsable } from '#/entities/payment-method/lib/expiry'
import { SavedCardRow } from '#/entities/payment-method/ui/saved-card-row/saved-card-row'
import {
  paymentMethodsBookView,
  paymentMethodsBookViewBack,
  paymentMethodsBookViewContent,
  paymentMethodsBookViewHeading,
  paymentMethodsBookViewTitle,
} from '#/features/account/components/payment-methods-book-view/payment-methods-book-view.variants'
import { WalletEmpty } from '#/features/account/components/wallet-empty/wallet-empty'
import { WalletSkeleton } from '#/features/account/components/wallet-skeleton/wallet-skeleton'
import { WalletUnavailable } from '#/features/account/components/wallet-unavailable/wallet-unavailable'
import type { PaymentMethodsLinks } from '#/features/account/types/links'
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
  links: PaymentMethodsLinks
}

export function PaymentMethodsBookView({
  methods,
  isLoading,
  failed,
  onRetry,
  onSetDefault,
  onRemove,
  links,
}: PaymentMethodsBookViewProps) {
  const { t } = useLingui()
  const defaultMethod = methods.find((method) => method.isDefault)

  return (
    <main className={cn(paymentMethodsBookView(), 'mx-auto w-full')}>
      <div className={paymentMethodsBookViewHeading()}>
        <BackLink link={links.account} className={paymentMethodsBookViewBack()}>
          <Trans>Back to account</Trans>
        </BackLink>
        <h1 className={paymentMethodsBookViewTitle()}>
          <Trans>Payment methods</Trans>
        </h1>
      </div>

      {/* The list of cards is not drawn (no seeded customer has one); the set's content slot
          holds the empty wallet. */}
      <div className={paymentMethodsBookViewContent()}>
        {isLoading ? (
          <WalletSkeleton />
        ) : failed ? (
          <WalletUnavailable onRetry={onRetry} />
        ) : methods.length === 0 ? (
          <WalletEmpty startShoppingLink={links.startShopping} />
        ) : (
          <>
            <h2 className="type-heading text-ink">
              <Trans>Your cards</Trans>
            </h2>
            <p className="mt-3 text-ink-muted text-sm">
              <Trans>
                Your default card is the one your next checkout starts on. Cards are saved by paying with them.
              </Trans>
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
                      ? t`${savedMethodName(method)}, your default card`
                      : t`Make ${savedMethodName(method)} the default`
                  }
                  onRemove={() => onRemove(method.id)}
                />
              ))}
            </RadioGroup>
            {methods.every((method) => !isUsable(method)) && (
              <p className="mt-4 text-ink-muted text-sm">
                <Trans>Every card here has expired. Pay with a new card at checkout to save a usable one.</Trans>
              </p>
            )}
          </>
        )}
      </div>
    </main>
  )
}

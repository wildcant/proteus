import { Trans } from '@lingui/react/macro'
import { ButtonLink } from '#/components/ui/button/button'
import {
  walletEmpty,
  walletEmptyAction,
  walletEmptyMessage,
  walletEmptyMessageText,
  walletEmptyStartShopping,
  walletEmptyTitle,
} from '#/features/account/components/wallet-empty/wallet-empty.variants'

/** Two lines of type and a way out, the same shape the address book's empty state uses. */
export function WalletEmpty() {
  return (
    <div className={walletEmpty()}>
      <h2 className={walletEmptyTitle()}>
        <Trans>No saved cards</Trans>
      </h2>
      <div className={walletEmptyMessage()}>
        <p className={walletEmptyMessageText()}>
          <Trans>
            Cards are saved at checkout — choose "Save this card for next time" when you pay and it will be here for
            your next order.
          </Trans>
        </p>
      </div>
      <div className={walletEmptyAction()}>
        <ButtonLink to="/" className={walletEmptyStartShopping()}>
          <Trans>Start shopping</Trans>
        </ButtonLink>
      </div>
    </div>
  )
}

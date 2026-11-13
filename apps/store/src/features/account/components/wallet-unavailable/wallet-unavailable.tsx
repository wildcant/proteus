import { Trans } from '@lingui/react/macro'
import { cn } from '@proteus/ui-core'
import { Button } from '#/components/ui/button/button'
import {
  walletUnavailable,
  walletUnavailableMessage,
  walletUnavailableRetry,
} from '#/features/account/components/wallet-unavailable/wallet-unavailable.variants'

/**
 * A wallet we could not read, told apart from an empty one.
 *
 * The distinction matters to the shopper: an empty wallet is a fact about them and a failed read
 * is a fact about us, and answering the second with "no saved cards" invites them to go and save
 * a card they already have.
 *
 * The ink left rule is written here: the design file holds one stroke colour per layer.
 */
export function WalletUnavailable({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" className={cn(walletUnavailable(), 'border-l-2 border-l-ink')}>
      <p className={walletUnavailableMessage()}>
        <Trans>We couldn't load your saved cards.</Trans>
      </p>
      <Button variant="link" className={walletUnavailableRetry()} onClick={onRetry}>
        <Trans>Try again</Trans>
      </Button>
    </div>
  )
}

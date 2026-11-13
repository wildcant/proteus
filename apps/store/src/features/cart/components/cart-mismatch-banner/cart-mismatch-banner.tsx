import { Trans } from '@lingui/react/macro'
import { cn } from '@proteus/ui-core'
import { Button } from '#/components/ui/button/button'
import { Icon } from '#/components/ui/icon/icon'
import { useCart, useTransferCart } from '#/entities/cart/api/cart'
import {
  cartMismatchBanner,
  cartMismatchBannerAction,
  cartMismatchBannerIcon,
  cartMismatchBannerMessage,
  cartMismatchBannerSeparator,
} from '#/features/cart/components/cart-mismatch-banner/cart-mismatch-banner.variants'

/**
 * Shown when a shopper is signed in but the cart still belongs to someone else — the transfer that
 * should have happened at login did not.
 *
 * It lives with `cart` because `useTransferCart` is the remedy. The app layer supplies `customerId`;
 * see `routes/_main/route.tsx`.
 */
export function CartMismatchBanner({ customerId }: { customerId: string | undefined }) {
  const { cart } = useCart()
  const transferCart = useTransferCart()

  if (!cart || !customerId || cart.customerId === customerId) return null

  return (
    <div className={cartMismatchBanner()}>
      <Icon name="circle-alert" className={cn(cartMismatchBannerIcon(), 'shrink-0')} />
      <span className={cartMismatchBannerMessage()}>
        <Trans>Something went wrong when we tried to transfer your cart</Trans>
      </span>
      <span aria-hidden="true" className={cartMismatchBannerSeparator()}>
        &middot;
      </span>
      <Button
        variant="link"
        onClick={() => transferCart.mutate()}
        disabled={transferCart.isPending}
        className={cartMismatchBannerAction()}
      >
        {transferCart.isPending ? <Trans>Transferring…</Trans> : <Trans>Run transfer again</Trans>}
      </Button>
    </div>
  )
}

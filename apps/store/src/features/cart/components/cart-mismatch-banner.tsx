import { Trans } from '@lingui/react/macro'
import { CircleAlertIcon } from 'lucide-react'
import { Button } from '#/components/button'
import { useCart, useTransferCart } from '#/entities/cart/api/cart'

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
    <div className="flex items-center justify-center gap-2 bg-orange-300 px-4 py-3 text-sm sm:gap-3 sm:px-6">
      <CircleAlertIcon className="h-5 w-5 shrink-0" />
      <span>
        <Trans>Something went wrong when we tried to transfer your cart</Trans>
      </span>
      <span aria-hidden="true">&middot;</span>
      <Button variant="link" onClick={() => transferCart.mutate()} disabled={transferCart.isPending}>
        {transferCart.isPending ? <Trans>Transferring…</Trans> : <Trans>Run transfer again</Trans>}
      </Button>
    </div>
  )
}

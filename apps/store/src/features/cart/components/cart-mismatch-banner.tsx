import { CircleAlertIcon } from 'lucide-react'
import { Button } from '#/components/button'
import { useCart, useTransferCart } from '#/features/cart/api/cart'

/**
 * Shown when a shopper is signed in but the cart still belongs to someone else — the transfer that
 * should have happened at login did not.
 *
 * It lives with `cart` because `useTransferCart` is the remedy, and takes `customerId` as a prop
 * rather than calling `useMe`: the banner needs cart *and* account, but `FEATURE_GRAPH` has
 * `cart: []`, and `cart -> account` would close the cycle `account -> auth -> cart -> account` that
 * ADR 0020 exists to forbid. So the app layer supplies the identity. See `routes/_main/route.tsx`.
 */
export function CartMismatchBanner({ customerId }: { customerId: string | undefined }) {
  const { cart } = useCart()
  const transferCart = useTransferCart()

  if (!cart || !customerId || cart.customerId === customerId) return null

  return (
    <div className="flex items-center justify-center gap-2 bg-orange-300 px-4 py-3 text-sm sm:gap-3 sm:px-6">
      <CircleAlertIcon className="h-5 w-5 shrink-0" />
      <span>Something went wrong when we tried to transfer your cart</span>
      <span aria-hidden="true">&middot;</span>
      <Button variant="link" onClick={() => transferCart.mutate()} disabled={transferCart.isPending}>
        {transferCart.isPending ? 'Transferring…' : 'Run transfer again'}
      </Button>
    </div>
  )
}

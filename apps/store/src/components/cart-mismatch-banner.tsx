import { CircleAlertIcon } from 'lucide-react'
import { Button } from '#/components/button'
import { useMe } from '#/features/account/api/customer'
import { useCart, useTransferCart } from '#/features/cart/api/cart'

export function CartMismatchBanner() {
  const { cart } = useCart()
  const { customer } = useMe()
  const transferCart = useTransferCart()

  const hasMismatch = !!cart && !!customer && cart.customerId !== customer.id

  if (!hasMismatch) return null

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

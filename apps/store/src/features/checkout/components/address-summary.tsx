import type { StoreCartDetailResponseCart } from '#/api/generated/model'

type AddressSummaryProps = {
  cart: StoreCartDetailResponseCart
}

export function AddressSummary({ cart }: AddressSummaryProps) {
  if (!cart.shippingAddress) {
    return null
  }

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      <div>
        <p className="font-medium text-(--foreground)">Address</p>
        <p>
          {cart.shippingAddress.firstName} {cart.shippingAddress.lastName}
        </p>
        <p>{cart.shippingAddress.address1}</p>
        <p>
          {cart.shippingAddress.city}, {cart.shippingAddress.province} {cart.shippingAddress.postalCode}
        </p>
        <p>{cart.shippingAddress.countryCode?.toUpperCase()}</p>
      </div>
      <div>
        <p className="font-medium text-(--foreground)">Contact</p>
        <p>{cart.email}</p>
        {!!cart.shippingAddress.phone && <p>{cart.shippingAddress.phone}</p>}
      </div>
    </div>
  )
}

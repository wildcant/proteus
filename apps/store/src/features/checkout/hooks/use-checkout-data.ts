import { useMemo, useState } from 'react'
import type { StoreCartDetailResponseCart } from '#/api/generated/model'
import { useMe } from '#/features/account/api/customer'
import { useAddresses } from '#/features/address/api/addresses'
import { isGuest } from '#/lib/auth-token'
import { toCartAddressInput } from '../checkout-address'

export type CheckoutDataParams = {
  cart: StoreCartDetailResponseCart
}

export function useCheckoutData({ cart }: CheckoutDataParams) {
  const isGuestCheckout = isGuest()
  const [providerId, setProviderId] = useState('')
  const { addresses, isLoading: isAddressesLoading } = useAddresses()
  const { customer } = useMe()

  const cartAddresses = useMemo(
    () =>
      customer && addresses.length > 0
        ? new Map(addresses.map((address) => [address.id, toCartAddressInput(address, customer)]))
        : null,
    [addresses, customer],
  )

  return {
    isGuestCheckout,
    providerId,
    setProviderId,
    addresses,
    isAddressesLoading,
    cart,
    customer,
    cartAddresses,
  }
}

export type CheckoutData = ReturnType<typeof useCheckoutData>

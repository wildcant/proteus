import { useState } from 'react'
import type { StoreCartDetailResponseCart } from '#/api/generated/model'
import { useMe } from '#/features/account/api/customer'
import { useAddresses } from '#/features/address/api/addresses'
import { isGuest } from '#/lib/auth-token'

export type CheckoutDataParams = {
  cart: StoreCartDetailResponseCart
}

export function useCheckoutData({ cart }: CheckoutDataParams) {
  const isGuestCheckout = isGuest()
  const [providerId, setProviderId] = useState('')
  const { addresses, isLoading: isAddressesLoading } = useAddresses()
  const { customer } = useMe()

  return {
    isGuestCheckout,
    providerId,
    setProviderId,
    addresses,
    isAddressesLoading,
    cart,
    customer,
  }
}

export type CheckoutData = ReturnType<typeof useCheckoutData>

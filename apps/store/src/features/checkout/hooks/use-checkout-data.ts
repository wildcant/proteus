import { useMemo, useState } from 'react'
import type { StoreCartDetailResponseCart } from '#/api/generated/model'
import { useMe } from '#/features/account/api/customer'
import { useAddresses } from '#/features/address/api/addresses'
import { isGuest } from '#/lib/auth-token'
import { useMarket } from '#/lib/use-market'
import { toCartAddressInput } from '../checkout-address'

export type CheckoutDataParams = {
  cart: StoreCartDetailResponseCart
}

export function useCheckoutData({ cart }: CheckoutDataParams) {
  const isGuestCheckout = isGuest()
  const [providerId, setProviderId] = useState('')
  const { addresses: savedAddresses, isLoading: isAddressesLoading } = useAddresses()
  const { customer } = useMe()
  const { current } = useMarket()

  /**
   * Only the addresses this market delivers to. The address book keeps every address a shopper
   * ever saved — switching market must not look like data loss — but checkout is where one of
   * them becomes a parcel, and offering a country the store cannot ship to means asking someone
   * to fill in a whole checkout before being told no.
   *
   * A shopper whose saved addresses are all elsewhere lands on the empty address form, which is
   * the same place a shopper with none at all lands.
   */
  const addresses = useMemo(
    () => savedAddresses.filter((address) => address.countryCode?.toLowerCase() === current.iso2),
    [savedAddresses, current.iso2],
  )

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

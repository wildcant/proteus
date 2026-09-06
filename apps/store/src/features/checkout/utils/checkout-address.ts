import { CartAddressInput } from '@proteus/http-schemas/store'
import { z } from 'zod'
import type { Customer, StoreCustomerAddress } from '#/api/generated/model'

/**
 * The address as the cart takes it, plus the id of the saved address it came from — the id is what
 * matches a value held in form state back to the live object after the address book rebuilds it.
 * An address typed by hand has none.
 */
export const CheckoutAddress = CartAddressInput.extend({ id: z.string().optional() })
export type CheckoutAddress = z.infer<typeof CheckoutAddress>

export function toCartAddressInput(address: StoreCustomerAddress, customer: Customer): CheckoutAddress {
  return {
    ...address,
    firstName: address.firstName ?? customer.firstName,
    lastName: address.lastName ?? customer.lastName,
    address1: address.address1 ?? '',
    city: address.city ?? '',
    countryCode: address.countryCode ?? '',
    postalCode: address.postalCode ?? '',
  }
}

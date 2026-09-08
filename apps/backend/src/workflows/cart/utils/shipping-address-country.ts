import type { CartAddressDTO } from '@core/types/cart/common.js'

/** Everything on a cart address except the country — the parts only a shopper can supply. */
const SHOPPER_SUPPLIED_FIELDS = [
  'company',
  'firstName',
  'lastName',
  'address1',
  'address2',
  'city',
  'province',
  'postalCode',
  'phone',
] as const satisfies readonly (keyof CartAddressDTO)[]

/**
 * Whether a shipping address is the shopper's own answer to where the order goes.
 *
 * A market that sells to exactly one country writes that country onto the cart, so a cart that has
 * never reached the address step can still hold an address row — one carrying nothing but a country
 * nobody chose. Reading that back as the shopper's answer would make the first market switch
 * permanent: switching home again would be refused for shipping to a country the switch itself
 * wrote. Anything beyond the country is something only a shopper types, which is what tells the two
 * apart.
 */
export function isShopperEnteredAddress(address: CartAddressDTO): boolean {
  return SHOPPER_SUPPLIED_FIELDS.some((field) => address[field] !== null)
}

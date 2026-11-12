import type { StoreCustomerAddress } from '#/api/generated/model'
import {
  addressLines,
  addressLinesPhone,
  addressLinesPhoneText,
  addressLinesPostal,
  addressLinesRecipient,
} from '#/entities/address/ui/address-lines/address-lines.variants'

/**
 * The postal fields, and only those. A cart's address row carries the same ten under different
 * surrounding metadata, so typing the prop this way lets checkout render what it is about to ship
 * to without a second copy of the formatting.
 */
type PostalFields = Pick<
  StoreCustomerAddress,
  | 'firstName'
  | 'lastName'
  | 'company'
  | 'address1'
  | 'address2'
  | 'city'
  | 'province'
  | 'postalCode'
  | 'countryCode'
  | 'phone'
>

/**
 * The postal block, shared by the list row and the Main address panel so the two can never drift
 * into formatting the same address differently.
 *
 * Street, locality and country are one line rather than an envelope-style stack. A row is far
 * wider than an address is long, and five short lines in it read as a narrow ribbon with a gulf
 * beside them; one long line uses the width it is given and wraps when it is not — which is what
 * the narrow Main address panel needs.
 */
export function AddressLines({ address }: { address: PostalFields }) {
  const recipient = [address.firstName, address.lastName].filter(Boolean).join(' ')
  const postal = [
    address.address1,
    address.address2,
    address.city,
    address.province,
    address.postalCode,
    address.countryCode?.toUpperCase(),
  ]
    .filter(Boolean)
    .join(', ')

  return (
    <div className={addressLines()}>
      {recipient ? <p className={addressLinesRecipient()}>{recipient}</p> : null}
      {/* Not drawn: no seeded address has a company. It reads as one more postal line. */}
      {address.company ? <p className={addressLinesPostal()}>{address.company}</p> : null}
      <p className={addressLinesPostal()}>{postal}</p>
      {address.phone ? (
        <div className={addressLinesPhone()}>
          <p className={addressLinesPhoneText()}>{address.phone}</p>
        </div>
      ) : null}
    </div>
  )
}

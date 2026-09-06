import type { StoreCreateAddress } from '@proteus/http-schemas/store'
import { formOptions } from '@tanstack/react-form'
import type { z } from 'zod'
import type { StoreCreateAddress as CreateAddressBody, StoreCustomerAddress } from '#/api/generated/model'

/**
 * The form's values are the create body's own input type, not a parallel all-strings type.
 * TanStack matches a standard-schema validator's input against the form values invariantly, so
 * anything else stops `StoreCreateAddress` from validating this form.
 *
 * `StoreUpdateAddress.required({ ...the four })` has a structurally identical input, which is
 * what lets both forms share one set of options.
 *
 * Every optional field still holds `''` at runtime — an input has nothing else to hold — and
 * `toPayload` puts the nulls back on the way out.
 */
export type AddressFormValues = z.input<typeof StoreCreateAddress>

export const EMPTY_ADDRESS: AddressFormValues = {
  addressName: '',
  firstName: '',
  lastName: '',
  company: '',
  address1: '',
  address2: '',
  city: '',
  countryCode: '',
  province: '',
  postalCode: '',
  phone: '',
  isDefault: false,
}

/** Same values the checkout's shipping form prefills, so both dev flows fill in one shape. */
export const TEST_ADDRESS: AddressFormValues = {
  addressName: 'Home',
  firstName: 'Joe',
  lastName: 'Doe',
  company: '',
  address1: '123 Main St',
  address2: '',
  city: 'Austin',
  countryCode: 'us',
  province: 'TX',
  postalCode: '78701',
  phone: '5551234567',
  isDefault: false,
}

/**
 * Shared by both address forms so `AddressForm` can be one `withForm` component: `withForm` is
 * bound to a single set of form options, and adding and editing an address differ only in which
 * schema validates them and which mutation they submit to.
 */
export const addressFormOpts = formOptions({ defaultValues: EMPTY_ADDRESS })

export function toFormValues(address: StoreCustomerAddress): AddressFormValues {
  return {
    addressName: address.addressName ?? '',
    firstName: address.firstName ?? '',
    lastName: address.lastName ?? '',
    company: address.company ?? '',
    address1: address.address1 ?? '',
    address2: address.address2 ?? '',
    city: address.city ?? '',
    countryCode: address.countryCode ?? '',
    province: address.province ?? '',
    postalCode: address.postalCode ?? '',
    phone: address.phone ?? '',
    // One checkbox stands for both flags; the endpoint moves them together.
    isDefault: address.isDefaultShipping || address.isDefaultBilling,
  }
}

/** An emptied optional field clears its column rather than storing an empty string in it. */
export function toPayload(values: AddressFormValues): CreateAddressBody {
  return {
    address1: values.address1,
    city: values.city,
    countryCode: values.countryCode,
    postalCode: values.postalCode,
    addressName: values.addressName || null,
    firstName: values.firstName || null,
    lastName: values.lastName || null,
    company: values.company || null,
    address2: values.address2 || null,
    province: values.province || null,
    phone: values.phone || null,
    isDefault: values.isDefault,
  }
}

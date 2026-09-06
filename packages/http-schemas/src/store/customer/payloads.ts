import { z } from 'zod'
import { countryCode, phone, postalCode, shortText } from '../../bounded.js'

export const CreateCustomer = z
  .object({
    firstName: shortText.min(1),
    lastName: shortText.min(1),
    email: z.email(),
  })
  .openapi('CreateCustomer')
export type CreateCustomerBody = z.infer<typeof CreateCustomer>

export const CreateCustomers = z.array(CreateCustomer).openapi('CreateCustomers')
export type CreateCustomersBody = z.infer<typeof CreateCustomers>

export const UpdateCustomer = z
  .object({
    firstName: shortText.min(1).optional(),
    lastName: shortText.min(1).optional(),
    email: z.email().optional(),
  })
  .openapi('UpdateCustomer')
export type UpdateCustomerBody = z.infer<typeof UpdateCustomer>

/**
 * The model makes every address column nullable, which is right for a row the checkout fills in
 * one field at a time. An address a shopper saved on purpose is different: the four fields a
 * courier cannot deliver without are required here rather than inherited as nullable.
 */
const addressFields = {
  // No minimum: this doubles as the storefront's form validator, where an untouched optional
  // input holds `''`. An empty label is simply no label — the form sends null for it.
  addressName: shortText.nullish(),
  company: shortText.nullish(),
  firstName: shortText.nullish(),
  lastName: shortText.nullish(),
  address2: shortText.nullish(),
  province: shortText.nullish(),
  phone: phone.nullish(),
}

export const StoreCreateAddress = z
  .object({
    ...addressFields,
    address1: shortText.min(1),
    city: shortText.min(1),
    countryCode: countryCode.min(2),
    postalCode: postalCode.min(1),
    // One checkbox in the UI; the endpoint sets both flags. See StoreCustomerAddress.
    isDefault: z.boolean().optional(),
  })
  .openapi('StoreCreateAddress')
export type StoreCreateAddressBody = z.infer<typeof StoreCreateAddress>

export const StoreUpdateAddress = z
  .object({
    ...addressFields,
    address1: shortText.min(1).optional(),
    city: shortText.min(1).optional(),
    countryCode: countryCode.min(2).optional(),
    postalCode: postalCode.min(1).optional(),
    isDefault: z.boolean().optional(),
  })
  .openapi('StoreUpdateAddress')
export type StoreUpdateAddressBody = z.infer<typeof StoreUpdateAddress>

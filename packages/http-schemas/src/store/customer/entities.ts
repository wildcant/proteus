import { z } from 'zod'
import { timestamps } from '../../common.js'

export const Customer = z
  .object({
    id: z.string(),
    hasAccount: z.boolean(),
    firstName: z.string().nullable(),
    lastName: z.string().nullable(),
    email: z.string(),
    ...timestamps.shape,
  })
  .openapi('Customer')
export type Customer = z.input<typeof Customer>

/**
 * The two default flags are collapsed into one checkbox in the storefront, but stay separate on
 * the wire: the model keeps them apart so a shopper who later needs a different billing address
 * costs a UI change rather than a migration.
 */
export const StoreCustomerAddress = z
  .object({
    id: z.string(),
    customerId: z.string(),
    addressName: z.string().nullable(),
    isDefaultShipping: z.boolean(),
    isDefaultBilling: z.boolean(),
    company: z.string().nullable(),
    firstName: z.string().nullable(),
    lastName: z.string().nullable(),
    address1: z.string().nullable(),
    address2: z.string().nullable(),
    city: z.string().nullable(),
    countryCode: z.string().nullable(),
    province: z.string().nullable(),
    postalCode: z.string().nullable(),
    phone: z.string().nullable(),
    ...timestamps.shape,
  })
  .openapi('StoreCustomerAddress')
export type StoreCustomerAddress = z.input<typeof StoreCustomerAddress>

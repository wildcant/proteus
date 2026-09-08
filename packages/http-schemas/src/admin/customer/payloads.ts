import { z } from 'zod'
import { shortText } from '../../bounded.js'

export const AdminCreateCustomer = z
  .object({
    firstName: shortText.min(1),
    lastName: shortText.min(1),
    email: z.email(),
  })
  .openapi('AdminCreateCustomer')
export type AdminCreateCustomerBody = z.infer<typeof AdminCreateCustomer>

export const AdminCreateCustomers = z.array(AdminCreateCustomer).openapi('AdminCreateCustomers')
export type AdminCreateCustomersBody = z.infer<typeof AdminCreateCustomers>

export const AdminUpdateCustomer = z
  .object({
    firstName: shortText.min(1).optional().nullable(),
    lastName: shortText.min(1).optional().nullable(),
    email: z.email().optional(),
  })
  .openapi('AdminUpdateCustomer')
export type AdminUpdateCustomerBody = z.infer<typeof AdminUpdateCustomer>

import { z } from 'zod'

export const AdminCreateCustomer = z
  .object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    email: z.email(),
  })
  .openapi('AdminCreateCustomer')
export type AdminCreateCustomerBody = z.infer<typeof AdminCreateCustomer>

export const AdminCreateCustomers = z.array(AdminCreateCustomer).openapi('AdminCreateCustomers')
export type AdminCreateCustomersBody = z.infer<typeof AdminCreateCustomers>

export const AdminUpdateCustomer = z
  .object({
    firstName: z.string().min(1).optional().nullable(),
    lastName: z.string().min(1).optional().nullable(),
    email: z.email().optional(),
  })
  .openapi('AdminUpdateCustomer')
export type AdminUpdateCustomerBody = z.infer<typeof AdminUpdateCustomer>

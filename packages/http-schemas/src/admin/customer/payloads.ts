import { i18n } from '@proteus/utils'
import { z } from 'zod'
import { phone, shortText } from '../../bounded.js'

export const AdminCreateCustomer = z
  .object({
    firstName: shortText.min(1),
    lastName: shortText.min(1),
    email: z.email().optional(),
    phone: phone.optional(),
  })
  .refine((customer) => customer.email !== undefined || customer.phone !== undefined, {
    message: i18n.t('A customer needs an email or a phone'),
    path: ['email'],
  })
  .openapi('AdminCreateCustomer')
export type AdminCreateCustomerBody = z.infer<typeof AdminCreateCustomer>

export const AdminCreateCustomers = z.array(AdminCreateCustomer).openapi('AdminCreateCustomers')
export type AdminCreateCustomersBody = z.infer<typeof AdminCreateCustomers>

export const AdminUpdateCustomer = z
  .object({
    firstName: shortText.min(1).optional().nullable(),
    lastName: shortText.min(1).optional().nullable(),
    email: z.email().optional().nullable(),
    phone: phone.optional().nullable(),
  })
  .openapi('AdminUpdateCustomer')
export type AdminUpdateCustomerBody = z.infer<typeof AdminUpdateCustomer>

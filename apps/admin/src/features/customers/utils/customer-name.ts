import type { AdminCustomer } from '#/api/generated/model'

export function customerName(customer: Pick<AdminCustomer, 'firstName' | 'lastName'>): string {
  return [customer.firstName, customer.lastName].filter(Boolean).join(' ')
}

import { z } from 'zod'
import { PaginatedResponse } from '../../common.js'
import { Customer, StoreCustomerAddress } from './entities.js'

export const CustomerResponse = z.object({ customer: Customer }).openapi('CustomerResponse')
export type CustomerResponse = z.input<typeof CustomerResponse>

export const CustomerListResponse = PaginatedResponse.extend({ customers: z.array(Customer) }).openapi(
  'CustomerListResponse',
)
export type CustomerListResponse = z.input<typeof CustomerListResponse>

export const StoreCustomerAddressResponse = z
  .object({ address: StoreCustomerAddress })
  .openapi('StoreCustomerAddressResponse')
export type StoreCustomerAddressResponse = z.input<typeof StoreCustomerAddressResponse>

export const StoreCustomerAddressListResponse = z
  .object({ addresses: z.array(StoreCustomerAddress) })
  .openapi('StoreCustomerAddressListResponse')
export type StoreCustomerAddressListResponse = z.input<typeof StoreCustomerAddressListResponse>

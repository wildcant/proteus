import type { FindConfig } from '../common.js'
import type { Context } from '../context.js'
import type {
  CustomerAddressDTO,
  CustomerDTO,
  FilterableCustomerAddressProps,
  FilterableCustomerProps,
} from './common.js'
import type {
  CreateCustomerAddressDTO,
  CreateCustomerDTO,
  UpdateCustomerAddressDTO,
  UpdateCustomerDTO,
} from './mutations.js'

export type ICustomerModuleService = {
  retrieveCustomer(customerId: string, config?: FindConfig<CustomerDTO>, context?: Context): Promise<CustomerDTO>
  retrieveCustomerWithAddresses(
    customerId: string,
    context?: Context,
  ): Promise<CustomerDTO & { addresses: CustomerAddressDTO[] }>
  listCustomers(
    filters?: FilterableCustomerProps,
    config?: FindConfig<CustomerDTO>,
    context?: Context,
  ): Promise<CustomerDTO[]>
  listAndCountCustomers(
    filters?: FilterableCustomerProps,
    config?: FindConfig<CustomerDTO>,
    context?: Context,
  ): Promise<[CustomerDTO[], number]>
  createCustomers(data: CreateCustomerDTO[], context?: Context): Promise<CustomerDTO[]>
  updateCustomers(customerIds: string[], data: UpdateCustomerDTO, context?: Context): Promise<CustomerDTO[]>
  createCustomer(data: CreateCustomerDTO, context?: Context): Promise<CustomerDTO>
  updateCustomer(customerId: string, data: UpdateCustomerDTO, context?: Context): Promise<CustomerDTO>
  softDeleteCustomers(customerIds: string[], context?: Context): Promise<void>
  restoreCustomers(customerIds: string[], context?: Context): Promise<void>

  listCustomerAddresses(
    filters?: FilterableCustomerAddressProps,
    config?: FindConfig<CustomerAddressDTO>,
    context?: Context,
  ): Promise<CustomerAddressDTO[]>
  createCustomerAddresses(data: CreateCustomerAddressDTO[], context?: Context): Promise<CustomerAddressDTO[]>
  updateCustomerAddresses(
    addressIds: string[],
    data: UpdateCustomerAddressDTO,
    context?: Context,
  ): Promise<CustomerAddressDTO[]>
  setDefaultAddress(customerId: string, addressId: string, context?: Context): Promise<CustomerAddressDTO>
  softDeleteCustomerAddresses(addressIds: string[], context?: Context): Promise<void>
  createCustomerAddress(data: CreateCustomerAddressDTO, context?: Context): Promise<CustomerAddressDTO>
  updateCustomerAddress(
    addressId: string,
    data: UpdateCustomerAddressDTO,
    context?: Context,
  ): Promise<CustomerAddressDTO>
}

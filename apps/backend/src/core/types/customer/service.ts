import type { FindConfig } from '../common.js'
import type { Context } from '../context.js'
import type {
  CustomerAddressDTO,
  CustomerDTO,
  FilterableCustomerAddressProps,
  FilterableCustomerProps,
} from './common.js'
import type {
  AddressDefaultOption,
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
  /**
   * Writes an address, claiming the customer's default slot for it when `makeDefault` is set.
   *
   * The write and the promotion share a transaction: promoting releases whichever address held
   * the slot, so a caller doing this in two calls can leave the customer with no default at all.
   */
  createCustomerAddress(
    data: CreateCustomerAddressDTO,
    options?: AddressDefaultOption,
    context?: Context,
  ): Promise<CustomerAddressDTO>
  /** Edits an address, claiming the default slot for it when `makeDefault` is set. A body with no
   *  field changes is allowed — a promotion on its own is a valid edit. */
  updateCustomerAddress(
    addressId: string,
    data: UpdateCustomerAddressDTO,
    options?: AddressDefaultOption,
    context?: Context,
  ): Promise<CustomerAddressDTO>
}

import type {
  Context,
  CreateCustomerAddressDTO,
  CreateCustomerDTO,
  CustomerAddressDTO,
  CustomerDTO,
  FilterableCustomerAddressProps,
  FilterableCustomerProps,
  FindConfig,
  ICustomerModuleService,
  UpdateCustomerAddressDTO,
  UpdateCustomerDTO,
} from '../../../core/types/index.js'
import type { Logger } from '../../../core/types/logger.js'
import type { WithTransaction } from '../../../core/utils/with-transaction.js'
import type { CustomerRepository } from '../repositories/customer.js'
import type { CustomerAddressRepository } from '../repositories/customer-address.js'

type InjectedDependencies = {
  customerRepository: CustomerRepository
  customerAddressRepository: CustomerAddressRepository
  withTransaction: WithTransaction
  logger: Logger
}

export class CustomerModuleService implements ICustomerModuleService {
  private customerRepository: CustomerRepository
  private customerAddressRepository: CustomerAddressRepository
  private withTransaction: WithTransaction
  private logger: Logger

  constructor({ customerRepository, customerAddressRepository, withTransaction, logger }: InjectedDependencies) {
    this.customerRepository = customerRepository
    this.customerAddressRepository = customerAddressRepository
    this.withTransaction = withTransaction
    this.logger = logger
  }

  async retrieveCustomer(
    customerId: string,
    config?: FindConfig<CustomerDTO>,
    context?: Context,
  ): Promise<CustomerDTO> {
    return this.customerRepository.findByIdOrFail(customerId, config, context)
  }

  async retrieveCustomerWithAddresses(
    customerId: string,
    context?: Context,
  ): Promise<CustomerDTO & { addresses: CustomerAddressDTO[] }> {
    const customer = await this.customerRepository.findByIdOrFail(customerId, undefined, context)
    const addresses = await this.customerAddressRepository.find({ customerId }, undefined, context)
    return { ...customer, addresses }
  }

  async listCustomers(
    filters?: FilterableCustomerProps,
    config?: FindConfig<CustomerDTO>,
    context?: Context,
  ): Promise<CustomerDTO[]> {
    return this.customerRepository.find(filters, config, context)
  }

  async listAndCountCustomers(
    filters?: FilterableCustomerProps,
    config?: FindConfig<CustomerDTO>,
    context?: Context,
  ): Promise<[CustomerDTO[], number]> {
    const [rows, count] = await this.customerRepository.findAndCount(filters, config, context)
    return [rows, count]
  }

  async createCustomers(data: CreateCustomerDTO[], context?: Context): Promise<CustomerDTO[]> {
    this.logger.debug(`Creating ${data.length} customer(s)`)
    return this.withTransaction(context, async (ctx) => {
      const customers = await this.customerRepository.createMany(data, ctx)

      const addressData = customers.flatMap((customer, i) =>
        (data[i]?.addresses ?? []).map((addr) => ({ ...addr, customerId: customer.id })),
      )
      if (addressData.length > 0) {
        await this.customerAddressRepository.createMany(addressData, ctx)
      }

      return customers
    })
  }

  async updateCustomers(customerIds: string[], data: UpdateCustomerDTO, context?: Context): Promise<CustomerDTO[]> {
    return this.withTransaction(context, async (ctx) => {
      return this.customerRepository.updateMany(customerIds, data, ctx)
    })
  }

  async createCustomer(data: CreateCustomerDTO, context?: Context): Promise<CustomerDTO> {
    return this.withTransaction(context, async (ctx) => {
      const customer = await this.customerRepository.create(data, ctx)

      const addressData = (data.addresses ?? []).map((addr) => ({ ...addr, customerId: customer.id }))
      if (addressData.length > 0) {
        await this.customerAddressRepository.createMany(addressData, ctx)
      }

      return customer
    })
  }

  async updateCustomer(customerId: string, data: UpdateCustomerDTO, context?: Context): Promise<CustomerDTO> {
    return this.withTransaction(context, async (ctx) => {
      return this.customerRepository.update(customerId, data, ctx)
    })
  }

  async softDeleteCustomers(customerIds: string[], context?: Context): Promise<void> {
    return this.withTransaction(context, async (ctx) => {
      await this.customerRepository.softDelete(customerIds, ctx)
    })
  }

  async restoreCustomers(customerIds: string[], context?: Context): Promise<void> {
    return this.withTransaction(context, async (ctx) => {
      await this.customerRepository.restore(customerIds, ctx)
    })
  }

  // ── Customer Address ──

  async listCustomerAddresses(
    filters?: FilterableCustomerAddressProps,
    config?: FindConfig<CustomerAddressDTO>,
    context?: Context,
  ): Promise<CustomerAddressDTO[]> {
    return this.customerAddressRepository.find(filters, config, context)
  }

  async createCustomerAddresses(data: CreateCustomerAddressDTO[], context?: Context): Promise<CustomerAddressDTO[]> {
    return this.withTransaction(context, async (ctx) => {
      return this.customerAddressRepository.createMany(data, ctx)
    })
  }

  async createCustomerAddress(data: CreateCustomerAddressDTO, context?: Context): Promise<CustomerAddressDTO> {
    return this.withTransaction(context, async (ctx) => {
      return this.customerAddressRepository.create(data, ctx)
    })
  }

  async updateCustomerAddress(
    addressId: string,
    data: UpdateCustomerAddressDTO,
    context?: Context,
  ): Promise<CustomerAddressDTO> {
    return this.withTransaction(context, async (ctx) => {
      return this.customerAddressRepository.update(addressId, data, ctx)
    })
  }

  async updateCustomerAddresses(
    addressIds: string[],
    data: UpdateCustomerAddressDTO,
    context?: Context,
  ): Promise<CustomerAddressDTO[]> {
    return this.withTransaction(context, async (ctx) => {
      return this.customerAddressRepository.updateMany(addressIds, data, ctx)
    })
  }

  /**
   * Promotes one address to the customer's default, clearing whichever address held the slot.
   *
   * The two partial unique indexes on `customer_address` make a second default a database error
   * rather than a last-write-wins, so the previous holder has to be released in the same
   * transaction as the promotion. Two calls from a route would leave a window where the write
   * fails, and a failure halfway through would leave the customer with no default at all.
   *
   * Both flags move together because the storefront offers one checkbox; keeping them separate
   * on the model is what leaves room to split them later without a migration.
   */
  async setDefaultAddress(customerId: string, addressId: string, context?: Context): Promise<CustomerAddressDTO> {
    return this.withTransaction(context, async (ctx) => {
      const addresses = await this.customerAddressRepository.find({ customerId }, undefined, ctx)

      const stale = addresses
        .filter((address) => address.id !== addressId && (address.isDefaultShipping || address.isDefaultBilling))
        .map((address) => address.id)

      if (stale.length > 0) {
        await this.customerAddressRepository.updateMany(
          stale,
          { isDefaultShipping: false, isDefaultBilling: false },
          ctx,
        )
      }

      return this.customerAddressRepository.update(addressId, { isDefaultShipping: true, isDefaultBilling: true }, ctx)
    })
  }

  async softDeleteCustomerAddresses(addressIds: string[], context?: Context): Promise<void> {
    return this.withTransaction(context, async (ctx) => {
      await this.customerAddressRepository.softDelete(addressIds, ctx)
    })
  }
}

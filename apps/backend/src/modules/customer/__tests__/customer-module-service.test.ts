import { AppError, ErrorTypes } from '@core/errors/app-error.js'
import { test } from '@tests/setup/test-extend.js'
import { buildCascadeGraph } from '../../../core/db/cascade-graph.js'
import { createWithTransaction } from '../../../core/utils/with-transaction.js'
import * as models from '../models/index.js'
import { CustomerRepository } from '../repositories/customer.js'
import { CustomerAddressRepository } from '../repositories/customer-address.js'
import { CustomerModuleService } from '../services/customer-module-service.js'

const cascadeGraph = buildCascadeGraph(models)

let service: CustomerModuleService

test.beforeEach(({ getDb, logger }) => {
  const customerRepository = new CustomerRepository({ getDb, cascadeGraph })
  const customerAddressRepository = new CustomerAddressRepository({ getDb, cascadeGraph })
  const withTransaction = createWithTransaction(getDb)
  service = new CustomerModuleService({ customerRepository, customerAddressRepository, withTransaction, logger })
})

test.describe('CustomerModuleService', () => {
  test('createCustomers', async ({ expect, dto }) => {
    const input = [dto.generate.createCustomer(), dto.generate.createCustomer()]

    const result = await service.createCustomers(input)

    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({
      firstName: input[0]?.firstName,
      lastName: input[0]?.lastName,
      email: input[0]?.email,
    })
    expect(result[0]?.id).toBeDefined()
    expect(result[0]?.createdAt).toBeInstanceOf(Date)
  })

  test('createCustomer with addresses persists both', async ({ expect, dto }) => {
    const created = await service.createCustomer(
      dto.generate.createCustomer({
        addresses: [
          dto.generate.createCustomerAddress({ isDefaultShipping: true }),
          dto.generate.createCustomerAddress({ isDefaultBilling: true }),
        ],
      }),
    )

    const customer = await service.retrieveCustomerWithAddresses(created.id)

    expect(customer.id).toBeDefined()
    expect(customer.addresses).toHaveLength(2)
    expect(customer.addresses.map((a) => a.customerId)).toEqual([customer.id, customer.id])
  })

  test('createCustomer rolls back customer when address insert fails', async ({ expect, dto }) => {
    const error = await service
      .createCustomer(
        dto.generate.createCustomer({
          addresses: [
            dto.generate.createCustomerAddress({ isDefaultShipping: true }),
            dto.generate.createCustomerAddress({ isDefaultShipping: true }), // violates partial unique index
          ],
        }),
      )
      .catch((e) => e)

    expect(AppError.isError(error)).toBe(true)
    expect(error.type).toBe(ErrorTypes.DUPLICATE_ERROR)

    // Customer should NOT exist — transaction rolled back
    const customers = await service.listCustomers()
    expect(customers).toHaveLength(0)
  })

  test('retrieveCustomer', async ({ expect, dto }) => {
    const created = await service.createCustomer(dto.generate.createCustomer())

    const result = await service.retrieveCustomer(created.id)

    expect(result).toMatchObject({
      id: created.id,
      firstName: created.firstName,
      lastName: created.lastName,
      email: created.email,
    })
  })

  test('listCustomers', async ({ expect, dto }) => {
    await service.createCustomers([
      dto.generate.createCustomer(),
      dto.generate.createCustomer(),
      dto.generate.createCustomer(),
    ])

    const result = await service.listCustomers()

    expect(result).toHaveLength(3)
  })

  test('listAndCountCustomers', async ({ expect, dto }) => {
    await service.createCustomers([
      dto.generate.createCustomer(),
      dto.generate.createCustomer(),
      dto.generate.createCustomer(),
    ])

    const [rows, count] = await service.listAndCountCustomers()

    expect(rows).toHaveLength(3)
    expect(count).toBe(3)
  })

  test('updateCustomer', async ({ expect, dto }) => {
    const created = await service.createCustomer(dto.generate.createCustomer())
    const update = dto.generate.updateCustomer({ firstName: 'Updated' })

    const updated = await service.updateCustomer(created.id, update)

    expect(updated.firstName).toBe('Updated')
    expect(updated.id).toBe(created.id)
  })

  test('softDeleteCustomers', async ({ expect, dto }) => {
    const created = await service.createCustomer(dto.generate.createCustomer())

    await service.softDeleteCustomers([created.id])

    const error = await service.retrieveCustomer(created.id).catch((e) => e)
    expect(AppError.isError(error)).toBe(true)
    expect(error.type).toBe(ErrorTypes.NOT_FOUND)
  })

  test('softDeleteCustomers also soft-deletes addresses', async ({ expect, dto }) => {
    const created = await service.createCustomer(
      dto.generate.createCustomer({
        addresses: [
          dto.generate.createCustomerAddress({ isDefaultShipping: true }),
          dto.generate.createCustomerAddress({ isDefaultBilling: true }),
        ],
      }),
    )

    await service.softDeleteCustomers([created.id])

    const customers = await service.listCustomers()
    expect(customers).toHaveLength(0)

    const addresses = await service.listCustomerAddresses({ customerId: created.id })
    expect(addresses).toHaveLength(0)
  })

  test('a new default billing address can be set after the old one is soft-deleted', async ({ expect, dto }) => {
    const customer = await service.createCustomer(
      dto.generate.createCustomer({ addresses: [dto.generate.createCustomerAddress({ isDefaultBilling: true })] }),
    )
    const [oldDefault] = await service.listCustomerAddresses({ customerId: customer.id })
    if (!oldDefault) throw new Error('expected the customer to have an address')

    await service.softDeleteCustomerAddresses([oldDefault.id])
    const newDefault = await service.createCustomerAddress({
      ...dto.generate.createCustomerAddress({ isDefaultBilling: true }),
      customerId: customer.id,
    })

    expect(newDefault.isDefaultBilling).toBe(true)
    const addresses = await service.listCustomerAddresses({ customerId: customer.id })
    expect(addresses.map((a) => a.id)).toEqual([newDefault.id])
  })

  test('a new default shipping address can be set after the old one is soft-deleted', async ({ expect, dto }) => {
    const customer = await service.createCustomer(
      dto.generate.createCustomer({ addresses: [dto.generate.createCustomerAddress({ isDefaultShipping: true })] }),
    )
    const [oldDefault] = await service.listCustomerAddresses({ customerId: customer.id })
    if (!oldDefault) throw new Error('expected the customer to have an address')

    await service.softDeleteCustomerAddresses([oldDefault.id])
    const newDefault = await service.createCustomerAddress({
      ...dto.generate.createCustomerAddress({ isDefaultShipping: true }),
      customerId: customer.id,
    })

    expect(newDefault.isDefaultShipping).toBe(true)
    const addresses = await service.listCustomerAddresses({ customerId: customer.id })
    expect(addresses.map((a) => a.id)).toEqual([newDefault.id])
  })

  test('restoreCustomers', async ({ expect, dto }) => {
    const created = await service.createCustomer(dto.generate.createCustomer())
    await service.softDeleteCustomers([created.id])

    await service.restoreCustomers([created.id])

    const list = await service.listCustomers()
    expect(list).toHaveLength(1)
    expect(list[0]?.id).toBe(created.id)
  })

  test.describe('error paths', () => {
    test('retrieveCustomer throws NOT_FOUND for non-existent id', async ({ expect }) => {
      const error = await service.retrieveCustomer('cus_nonexistent').catch((e) => e)

      expect(AppError.isError(error)).toBe(true)
      expect(error.type).toBe(ErrorTypes.NOT_FOUND)
      expect(error.message).toContain('cus_nonexistent')
    })

    test('retrieveCustomer throws NOT_FOUND for soft-deleted customer', async ({ expect, dto }) => {
      const created = await service.createCustomer(dto.generate.createCustomer())
      await service.softDeleteCustomers([created.id])

      const error = await service.retrieveCustomer(created.id).catch((e) => e)

      expect(AppError.isError(error)).toBe(true)
      expect(error.type).toBe(ErrorTypes.NOT_FOUND)
    })

    test('createCustomers with missing required field throws INVALID_DATA', async ({ expect }) => {
      // biome-ignore lint/suspicious/noExplicitAny: intentionally invalid input to test runtime error
      const invalid = { firstName: 'Test', lastName: 'User' } as any

      const error = await service.createCustomers([invalid]).catch((e) => e)

      expect(AppError.isError(error)).toBe(true)
      expect(error.type).toBe(ErrorTypes.INVALID_DATA)
    })

    test('updateCustomers with non-existent ids returns empty array', async ({ expect, dto }) => {
      const update = dto.generate.updateCustomer({ firstName: 'Ghost' })

      const result = await service.updateCustomers(['cus_nonexistent'], update)

      expect(result).toEqual([])
    })

    test('updateCustomers with soft-deleted id returns empty array', async ({ expect, dto }) => {
      const created = await service.createCustomer(dto.generate.createCustomer())
      await service.softDeleteCustomers([created.id])
      const update = dto.generate.updateCustomer({ firstName: 'Ghost' })

      const result = await service.updateCustomers([created.id], update)

      expect(result).toEqual([])
    })

    test('softDeleteCustomers with non-existent ids does not throw', async ({ expect }) => {
      await expect(service.softDeleteCustomers(['cus_nonexistent'])).resolves.toBeUndefined()
    })

    test('restoreCustomers on non-soft-deleted customer does not throw', async ({ expect, dto }) => {
      const created = await service.createCustomer(dto.generate.createCustomer())

      await expect(service.restoreCustomers([created.id])).resolves.toBeUndefined()
    })

    test('createCustomers with empty array returns empty array', async ({ expect }) => {
      const result = await service.createCustomers([])

      expect(result).toEqual([])
    })

    test('updateCustomers with empty ids returns empty array', async ({ expect, dto }) => {
      const update = dto.generate.updateCustomer()

      const result = await service.updateCustomers([], update)

      expect(result).toEqual([])
    })

    test('softDeleteCustomers with empty ids does not throw', async ({ expect }) => {
      await expect(service.softDeleteCustomers([])).resolves.toBeUndefined()
    })

    test('restoreCustomers with empty ids does not throw', async ({ expect }) => {
      await expect(service.restoreCustomers([])).resolves.toBeUndefined()
    })
  })
})

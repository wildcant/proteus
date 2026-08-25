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

test.describe('hasAccount behavior', () => {
  test('create customer with hasAccount: false and only email succeeds', async ({ expect }) => {
    const customer = await service.createCustomer({ email: 'guest@example.com' })

    expect(customer.hasAccount).toBe(false)
    expect(customer.firstName).toBeNull()
    expect(customer.lastName).toBeNull()
    expect(customer.email).toBe('guest@example.com')
  })

  test('two customers with same email but different hasAccount values both persist', async ({ expect }) => {
    const guest = await service.createCustomer({ email: 'shared@example.com', hasAccount: false })
    const registered = await service.createCustomer({
      email: 'shared@example.com',
      hasAccount: true,
      firstName: 'Jane',
      lastName: 'Doe',
    })

    expect(guest.id).not.toBe(registered.id)
    expect(guest.hasAccount).toBe(false)
    expect(registered.hasAccount).toBe(true)
  })

  test('two customers with same email and same hasAccount value fails', async ({ expect }) => {
    await service.createCustomer({ email: 'dupe@example.com', hasAccount: false })

    const error = await service.createCustomer({ email: 'dupe@example.com', hasAccount: false }).catch((e) => e)

    expect(AppError.isError(error)).toBe(true)
    expect(error.type).toBe(ErrorTypes.DUPLICATE_ERROR)
  })

  test('retrieve customer with null firstName/lastName returns null', async ({ expect }) => {
    const created = await service.createCustomer({ email: 'nullnames@example.com' })

    const customer = await service.retrieveCustomer(created.id)

    expect(customer.firstName).toBeNull()
    expect(customer.lastName).toBeNull()
  })

  test('filter customers by hasAccount returns only matching records', async ({ expect }) => {
    await service.createCustomers([
      { email: 'guest1@example.com', hasAccount: false },
      { email: 'guest2@example.com', hasAccount: false },
      { email: 'user1@example.com', hasAccount: true, firstName: 'A', lastName: 'B' },
    ])

    const guests = await service.listCustomers({ hasAccount: false })
    const registered = await service.listCustomers({ hasAccount: true })

    expect(guests).toHaveLength(2)
    expect(registered).toHaveLength(1)
    expect(registered[0]?.hasAccount).toBe(true)
  })

  test('hasAccount defaults to false when not specified', async ({ expect }) => {
    const customer = await service.createCustomer({ email: 'default@example.com', firstName: 'Test', lastName: 'User' })

    expect(customer.hasAccount).toBe(false)
  })
})

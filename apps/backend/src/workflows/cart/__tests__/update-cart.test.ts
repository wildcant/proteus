import type { CartDTO } from '@core/types/cart/common.js'
import type { CustomerDTO } from '@core/types/customer/common.js'
import { Modules } from '@core/utils/index.js'
import { createSimpleWorkflowEngine } from '@core/workflows/simple-adapter.js'
import { setWorkflowEngine } from '@core/workflows/types.js'
import { type Fixtures, test } from '@tests/setup/test-extend.js'
import { asValue, createContainer } from 'awilix'
import { describe, expect, vi } from 'vitest'
import { updateCartWorkflow } from '../update-cart.js'

function setup(
  generate: Fixtures['dto']['generate'],
  overrides?: {
    cart?: CartDTO
    existingGuestCustomer?: CustomerDTO | null
  },
) {
  const cart = overrides?.cart ?? generate.cart({ customerId: null, email: null })
  const existingGuestCustomer = overrides?.existingGuestCustomer ?? null

  let currentCart: CartDTO = cart
  const cartService = {
    retrieveCart: vi.fn().mockImplementation(async () => currentCart),
    updateCart: vi.fn().mockImplementation(async (_id: string, updates: Partial<CartDTO>) => {
      currentCart = { ...currentCart, ...updates }
      return currentCart
    }),
    updateCartWithAddresses: vi.fn().mockImplementation(async (_id: string, updates: Record<string, unknown>) => {
      if (updates.email) currentCart = { ...currentCart, email: updates.email as string }
      return currentCart
    }),
  }

  const createdCustomer = generate.customer({
    id: 'cus_new_guest',
    hasAccount: false,
    email: 'guest@example.com',
    firstName: null,
    lastName: null,
  })

  const customerService = {
    listCustomers: vi.fn().mockImplementation(async (filters: { hasAccount?: boolean }) => {
      if (!existingGuestCustomer) return []
      if (filters.hasAccount !== undefined && filters.hasAccount !== existingGuestCustomer.hasAccount) return []
      return [existingGuestCustomer]
    }),
    createCustomer: vi.fn().mockImplementation(async (data: Partial<CustomerDTO>) => ({
      ...createdCustomer,
      ...data,
    })),
    updateCustomer: vi.fn().mockImplementation(async (_id: string, data: Partial<CustomerDTO>) => ({
      ...(existingGuestCustomer ?? createdCustomer),
      ...data,
    })),
    deleteCustomers: vi.fn().mockResolvedValue(undefined),
  }

  const container = createContainer()
  container.register({
    [Modules.CART]: asValue(cartService),
    [Modules.CUSTOMER]: asValue(customerService),
  })

  setWorkflowEngine(createSimpleWorkflowEngine(), container)

  return { cart, cartService, customerService, createdCustomer }
}

describe('updateCartWorkflow', () => {
  test('email provided, no existing guest — creates guest customer, sets customerId and email on cart', async ({
    dto,
  }) => {
    const services = setup(dto.generate)

    await updateCartWorkflow.run({
      cartId: services.cart.id,
      email: 'guest@example.com',
    })

    expect(services.customerService.listCustomers).toHaveBeenCalledWith({
      email: 'guest@example.com',
      hasAccount: false,
    })

    expect(services.customerService.createCustomer).toHaveBeenCalledWith({
      email: 'guest@example.com',
      hasAccount: false,
    })

    expect(services.cartService.updateCart).toHaveBeenCalledWith(services.cart.id, {
      customerId: 'cus_new_guest',
      email: 'guest@example.com',
    })
  })

  test('email provided, existing guest found — reuses customer, sets customerId on cart', async ({ dto }) => {
    const existingGuest = dto.generate.customer({
      id: 'cus_existing_guest',
      hasAccount: false,
      email: 'returning@example.com',
      firstName: 'Jane',
      lastName: 'Doe',
    })

    const services = setup(dto.generate, { existingGuestCustomer: existingGuest })

    await updateCartWorkflow.run({
      cartId: services.cart.id,
      email: 'returning@example.com',
    })

    expect(services.customerService.createCustomer).not.toHaveBeenCalled()

    expect(services.cartService.updateCart).toHaveBeenCalledWith(services.cart.id, {
      customerId: 'cus_existing_guest',
      email: 'returning@example.com',
    })
  })

  test('email provided with firstName/lastName — passes name fields to customer creation', async ({ dto }) => {
    const services = setup(dto.generate)

    await updateCartWorkflow.run({
      cartId: services.cart.id,
      email: 'named@example.com',
      firstName: 'Alice',
      lastName: 'Smith',
    })

    expect(services.customerService.createCustomer).toHaveBeenCalledWith({
      email: 'named@example.com',
      hasAccount: false,
      firstName: 'Alice',
      lastName: 'Smith',
    })
  })

  test('no email provided — skips findOrCreateCustomer, only updates addresses', async ({ dto }) => {
    const services = setup(dto.generate)

    await updateCartWorkflow.run({
      cartId: services.cart.id,
      shippingAddress: {
        firstName: 'John',
        lastName: 'Doe',
        address1: '123 Main St',
        city: 'Springfield',
        countryCode: 'US',
        postalCode: '62701',
      },
    })

    expect(services.customerService.listCustomers).not.toHaveBeenCalled()
    expect(services.customerService.createCustomer).not.toHaveBeenCalled()
    expect(services.cartService.updateCart).not.toHaveBeenCalled()

    expect(services.cartService.updateCartWithAddresses).toHaveBeenCalledOnce()
  })

  test('workflow failure after customer creation — compensates by deleting the newly created customer', async ({
    dto,
  }) => {
    const services = setup(dto.generate)

    // Make updateCartWithAddresses fail to trigger compensation
    services.cartService.updateCartWithAddresses.mockRejectedValue(new Error('Address update failed'))

    await expect(
      updateCartWorkflow.run({
        cartId: services.cart.id,
        email: 'guest@example.com',
      }),
    ).rejects.toThrow('Address update failed')

    // Compensation should have deleted the newly created customer
    expect(services.customerService.deleteCustomers).toHaveBeenCalledWith(['cus_new_guest'])
  })

  test('workflow failure after finding existing customer — does NOT delete the existing customer', async ({ dto }) => {
    const existingGuest = dto.generate.customer({
      id: 'cus_existing',
      hasAccount: false,
      email: 'existing@example.com',
    })

    const services = setup(dto.generate, { existingGuestCustomer: existingGuest })

    services.cartService.updateCartWithAddresses.mockRejectedValue(new Error('Address update failed'))

    await expect(
      updateCartWorkflow.run({
        cartId: services.cart.id,
        email: 'existing@example.com',
      }),
    ).rejects.toThrow('Address update failed')

    // Should NOT delete existing customer — only newly created ones get compensated
    expect(services.customerService.deleteCustomers).not.toHaveBeenCalled()
  })

  test('workflow failure after name update — compensates by reverting to previous name', async ({ dto }) => {
    const existingGuest = dto.generate.customer({
      id: 'cus_existing',
      hasAccount: false,
      email: 'existing@example.com',
      firstName: 'Old',
      lastName: 'Name',
    })

    const services = setup(dto.generate, { existingGuestCustomer: existingGuest })

    services.cartService.updateCartWithAddresses.mockRejectedValue(new Error('Address update failed'))

    await expect(
      updateCartWorkflow.run({
        cartId: services.cart.id,
        email: 'existing@example.com',
        firstName: 'New',
        lastName: 'Name',
      }),
    ).rejects.toThrow('Address update failed')

    expect(services.customerService.deleteCustomers).not.toHaveBeenCalled()
    expect(services.customerService.updateCustomer).toHaveBeenLastCalledWith('cus_existing', {
      firstName: 'Old',
      lastName: 'Name',
    })
  })
})

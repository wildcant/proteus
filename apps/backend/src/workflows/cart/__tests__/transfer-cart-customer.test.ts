import type { CartDTO } from '@core/types/cart/common.js'
import type { CustomerDTO } from '@core/types/customer/common.js'
import { Modules } from '@core/utils/index.js'
import { createSimpleWorkflowEngine } from '@core/workflows/simple-adapter.js'
import { setWorkflowEngine } from '@core/workflows/types.js'
import { type Fixtures, test } from '@tests/setup/test-extend.js'
import { asValue, createContainer } from 'awilix'
import { vi } from 'vitest'
import { transferCartCustomerWorkflow } from '../transfer-cart-customer.js'

function setup(generate: Fixtures['dto']['generate'], overrides?: { cart?: CartDTO; customer?: CustomerDTO | null }) {
  const customer =
    overrides?.customer !== undefined
      ? overrides.customer
      : generate.customer({ id: 'cus_registered', hasAccount: true, email: 'registered@example.com' })

  const cart = overrides?.cart ?? generate.cart({ customerId: null, email: 'guest@example.com' })

  const cartService = {
    retrieveCart: vi.fn().mockResolvedValue(cart),
    updateCart: vi.fn().mockImplementation(async (_id: string, updates: Partial<CartDTO>) => ({
      ...cart,
      ...updates,
    })),
  }

  const customerService = {
    retrieveCustomer: customer
      ? vi.fn().mockResolvedValue(customer)
      : vi.fn().mockRejectedValue(new Error('Customer not found')),
  }

  const container = createContainer()
  container.register({
    [Modules.CART]: asValue(cartService),
    [Modules.CUSTOMER]: asValue(customerService),
  })

  setWorkflowEngine(createSimpleWorkflowEngine(), container)

  return { cart, customer, cartService, customerService }
}

test.describe('transferCartCustomerWorkflow', () => {
  test('transfers guest cart to registered customer — updates customerId and email', async ({ dto, expect }) => {
    const services = setup(dto.generate)

    const result = await transferCartCustomerWorkflow.run({
      cartId: services.cart.id,
      customerId: 'cus_registered',
    })

    expect(services.cartService.updateCart).toHaveBeenCalledWith(services.cart.id, {
      customerId: 'cus_registered',
      email: 'registered@example.com',
    })
    expect(result.customerId).toBe('cus_registered')
    expect(result.email).toBe('registered@example.com')
  })

  test('cart already belongs to target customer — no-op, no update call', async ({ dto, expect }) => {
    const customer = dto.generate.customer({ id: 'cus_same', hasAccount: true, email: 'same@example.com' })
    const cart = dto.generate.cart({ customerId: 'cus_same', email: 'same@example.com' })
    const services = setup(dto.generate, { cart, customer })

    const result = await transferCartCustomerWorkflow.run({
      cartId: cart.id,
      customerId: 'cus_same',
    })

    expect(services.cartService.updateCart).not.toHaveBeenCalled()
    expect(result.customerId).toBe('cus_same')
  })

  test('target customer not found — throws error', async ({ dto, expect }) => {
    const services = setup(dto.generate, { customer: null })

    await expect(
      transferCartCustomerWorkflow.run({
        cartId: services.cart.id,
        customerId: 'cus_nonexistent',
      }),
    ).rejects.toThrow('Customer with id "cus_nonexistent" not found')
  })
})

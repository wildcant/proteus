import type { TestContainer } from '@tests/setup/create-container.js'
import { test } from '@tests/setup/test-extend.js'
import { transferCartCustomerWorkflow } from '../transfer-cart-customer.js'

let container: TestContainer

test.beforeEach(async ({ createTestContainer }) => {
  container = await createTestContainer()
})

test.describe('transferCartCustomerWorkflow', () => {
  test('moves a guest cart to the registered customer, taking their email with it', async ({ service, expect }) => {
    const customer = await service.create.customer(container, { hasAccount: true })
    const { id: cartId } = await service.create.cart(container, { customerId: null })

    const result = await transferCartCustomerWorkflow.run({ cartId, customerId: customer.id })

    expect(result).toMatchObject({ customerId: customer.id, email: customer.email })
    expect(await service.read.cart(container, cartId)).toMatchObject({
      customerId: customer.id,
      email: customer.email,
    })
  })

  test('leaves a cart that already belongs to the customer alone', async ({ service, expect }) => {
    const customer = await service.create.customer(container, { hasAccount: true })
    // A different email on the cart than on the customer: transferring would overwrite it, so
    // this is what the no-op guard actually protects.
    const { id: cartId, email } = await service.create.cart(container, { customerId: customer.id })

    const result = await transferCartCustomerWorkflow.run({ cartId, customerId: customer.id })

    expect(result.email).toBe(email)
    expect(await service.read.cart(container, cartId)).toMatchObject({ customerId: customer.id, email })
  })

  test('rejects a customer that does not exist', async ({ service, expect }) => {
    const { id: cartId } = await service.create.cart(container, { customerId: null })

    await expect(transferCartCustomerWorkflow.run({ cartId, customerId: 'cus_nonexistent' })).rejects.toThrow(
      'Customer with id "cus_nonexistent" not found',
    )
  })
})

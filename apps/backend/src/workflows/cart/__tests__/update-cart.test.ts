import type { ICartModuleService } from '@core/types/cart/service.js'
import { Modules } from '@core/utils/index.js'
import type { TestContainer } from '@tests/setup/create-container.js'
import { test } from '@tests/setup/test-extend.js'
import { vi } from 'vitest'
import { updateCartWorkflow } from '../update-cart.js'

/** The workflow takes the store's request body, not the module DTO — its address fields are
 *  required and non-null, so `generateCreateCartAddressDTO` does not fit it. */
const SHIPPING_ADDRESS = {
  firstName: 'John',
  lastName: 'Doe',
  address1: '123 Main St',
  city: 'Springfield',
  countryCode: 'US',
  postalCode: '62701',
}

let container: TestContainer

test.beforeEach(async ({ createTestContainer }) => {
  container = await createTestContainer()
})

/** The workflow's last write. Failing it is what puts the earlier steps into rollback. */
const breakTheFinalWrite = () =>
  vi
    .spyOn(container.resolve<ICartModuleService>(Modules.CART), 'updateCartWithAddresses')
    .mockRejectedValueOnce(new Error('Address update failed'))

test.describe('updateCartWorkflow', () => {
  test('creates a guest customer for a new email and links it to the cart', async ({ service, expect }) => {
    const { id: cartId } = await service.create.cart(container, { customerId: null, email: null })

    await updateCartWorkflow.run({ cartId, email: 'guest@example.com' })

    const [guest] = await service.read.customers(container, { email: 'guest@example.com' })
    expect(guest).toMatchObject({ email: 'guest@example.com', hasAccount: false })
    expect(await service.read.cart(container, cartId)).toMatchObject({
      customerId: guest?.id,
      email: 'guest@example.com',
    })
  })

  test('reuses an existing guest instead of creating a second one', async ({ service, expect }) => {
    const existing = await service.create.customer(container, {
      email: 'returning@example.com',
      hasAccount: false,
    })
    const { id: cartId } = await service.create.cart(container, { customerId: null, email: null })

    await updateCartWorkflow.run({ cartId, email: 'returning@example.com' })

    expect(await service.read.customers(container, { email: 'returning@example.com' })).toHaveLength(1)
    expect(await service.read.cart(container, cartId)).toMatchObject({ customerId: existing.id })
  })

  test('puts the supplied name on the guest it creates', async ({ service, expect }) => {
    const { id: cartId } = await service.create.cart(container, { customerId: null, email: null })

    await updateCartWorkflow.run({
      cartId,
      email: 'named@example.com',
      firstName: 'Alice',
      lastName: 'Smith',
    })

    expect(await service.read.customers(container, { email: 'named@example.com' })).toMatchObject([
      { firstName: 'Alice', lastName: 'Smith', hasAccount: false },
    ])
  })

  test('creates no customer when no email is given', async ({ service, expect }) => {
    const { id: cartId } = await service.create.cart(container, { customerId: null, email: null })

    const result = await updateCartWorkflow.run({ cartId, shippingAddress: SHIPPING_ADDRESS })

    expect(await service.read.customers(container)).toEqual([])
    expect(await service.read.cart(container, cartId)).toMatchObject({ customerId: null })
    expect(result.shippingAddressId).not.toBeNull()
  })

  test('rollback deletes a guest it created', async ({ service, expect }) => {
    const { id: cartId } = await service.create.cart(container, { customerId: null, email: null })
    breakTheFinalWrite()

    await expect(updateCartWorkflow.run({ cartId, email: 'guest@example.com' })).rejects.toThrow(
      'Address update failed',
    )

    expect(await service.read.customers(container, { email: 'guest@example.com' })).toEqual([])
  })

  test('rollback leaves a guest it merely found', async ({ service, expect }) => {
    const existing = await service.create.customer(container, {
      email: 'existing@example.com',
      hasAccount: false,
    })
    const { id: cartId } = await service.create.cart(container, { customerId: null, email: null })
    breakTheFinalWrite()

    await expect(updateCartWorkflow.run({ cartId, email: 'existing@example.com' })).rejects.toThrow(
      'Address update failed',
    )

    expect(await service.read.customer(container, existing.id)).toMatchObject({ id: existing.id })
  })

  test('rollback restores the name it overwrote', async ({ service, expect }) => {
    const existing = await service.create.customer(container, {
      email: 'existing@example.com',
      hasAccount: false,
      firstName: 'Old',
      lastName: 'Name',
    })
    const { id: cartId } = await service.create.cart(container, { customerId: null, email: null })
    breakTheFinalWrite()

    await expect(
      updateCartWorkflow.run({ cartId, email: 'existing@example.com', firstName: 'New', lastName: 'Name' }),
    ).rejects.toThrow('Address update failed')

    expect(await service.read.customer(container, existing.id)).toMatchObject({
      firstName: 'Old',
      lastName: 'Name',
    })
  })
})

import { BigNumber } from '@core/db/bignum.js'
import type { CartAddressDTO, CartDTO, CartLineItemDTO, CartShippingMethodDTO } from '@core/types/cart/common.js'
import type { ILinkService } from '@core/types/link/service.js'
import type { PaymentCollectionDTO } from '@core/types/payment/common.js'
import { ContainerRegistrationKeys, Modules } from '@core/utils/index.js'
import { createSimpleWorkflowEngine } from '@core/workflows/simple-adapter.js'
import { setWorkflowEngine } from '@core/workflows/types.js'
import { type Fixtures, test } from '@tests/setup/test-extend.js'
import { asValue, createContainer } from 'awilix'
import { describe, expect, vi } from 'vitest'
import { noopLogger } from '../../../framework/logger/noop-logger.js'
import { completeCartWorkflow } from '../complete-cart.js'

type SetupOptions = {
  cart?: CartDTO
  address?: CartAddressDTO | null
  lineItems?: CartLineItemDTO[]
  shippingMethods?: CartShippingMethodDTO[]
  orderCartLink?: { orderId: string; cartId: string } | null
  variantMappings?: Array<{ variantId: string; inventoryItemId: string; requiredQuantity?: number }>
  inventoryLevels?: Array<{ inventoryItemId: string; locationId: string; stockedQuantity: number }>
}

function setupWorkflow(generate: Fixtures['dto']['generate'], options: SetupOptions = {}) {
  const cart = options.cart ?? generate.cart({ customerId: 'cus_1', shippingAddressId: 'caaddr_1' })
  const address = options.address !== undefined ? options.address : generate.cartAddress({ customerId: 'cus_1' })
  const lineItems = options.lineItems ?? [generate.cartLineItem({ cartId: cart.id, variantId: 'var_1' })]
  const shippingMethods = options.shippingMethods ?? [generate.cartShippingMethod({ cartId: cart.id })]
  const initialOrderCartLink = options.orderCartLink ?? null

  const createdOrder = generate.order({
    id: 'ord_1',
    email: cart.email,
    customerId: cart.customerId,
    currencyCode: cart.currencyCode,
    shippingAddressId: 'ordaddr_1',
  })

  const capturedPayment = generate.payment({
    amount: new BigNumber(1500),
    providerId: 'stripe',
    capturedAt: new Date(),
    captures: [
      {
        id: 'cap_1',
        amount: new BigNumber(1500),
        paymentId: 'pay_1',
        createdBy: null,
        metadata: null,
        createdAt: new Date(),
      },
    ],
  })

  let currentCart: CartDTO = cart
  const cartService = {
    retrieveCart: vi.fn().mockImplementation(async () => currentCart),
    retrieveCartAddress: vi.fn().mockImplementation(async (id: string) => {
      if (!address) throw new Error(`Address ${id} not found`)
      return address
    }),
    listLineItems: vi.fn().mockResolvedValue(lineItems),
    listShippingMethods: vi.fn().mockResolvedValue(shippingMethods),
    updateCart: vi.fn().mockImplementation(async (_id: string, updates: Partial<CartDTO>) => {
      currentCart = { ...currentCart, ...updates }
      return currentCart
    }),
  }

  const fulfillmentService = {
    retrieveShippingOption: vi.fn().mockResolvedValue({ isEnabled: true }),
  }

  const paymentService = {
    retrievePaymentCollection: vi.fn().mockResolvedValue({
      id: 'paycol_1',
      currencyCode: 'usd',
      amount: new BigNumber(1500),
      status: 'authorized',
      paymentSessions: [
        generate.paymentSession({
          providerId: 'stripe',
          amount: new BigNumber(1500),
          status: 'authorized',
          authorizedAt: new Date(),
        }),
      ],
    } as PaymentCollectionDTO),
    authorizePaymentSession: vi.fn().mockResolvedValue(capturedPayment),
    capturePayment: vi.fn().mockResolvedValue(capturedPayment),
    refundPayment: vi.fn().mockResolvedValue(undefined),
    cancelPayment: vi.fn().mockResolvedValue(undefined),
  }

  const orderService = {
    createOrder: vi.fn().mockResolvedValue(createdOrder),
    retrieveOrder: vi.fn().mockResolvedValue(createdOrder),
    createOrderAddresses: vi
      .fn()
      .mockImplementation(async (data: Record<string, unknown>[]) =>
        data.map((entry, i) => ({ id: `ordaddr_${i + 1}`, ...entry })),
      ),
    addOrderTransaction: vi.fn().mockResolvedValue({ id: 'ordtrx_1' }),
    deleteOrders: vi.fn().mockResolvedValue(undefined),
  }

  const inventoryService = {
    listInventoryLevels: vi.fn().mockResolvedValue(
      (options.inventoryLevels ?? [{ inventoryItemId: 'inv_1', locationId: 'loc_1', stockedQuantity: 10 }]).map(
        (l) => ({
          id: `ilev_${l.inventoryItemId}`,
          ...l,
          reservedQuantity: 0,
          incomingQuantity: 0,
          metadata: null,
          createdAt: new Date(),
          deletedAt: null,
        }),
      ),
    ),
    createReservationItems: vi.fn().mockResolvedValue([{ id: 'resitem_1' }]),
    deleteReservationItems: vi.fn().mockResolvedValue(undefined),
    listReservationItems: vi.fn().mockResolvedValue([]),
  }

  const orderCartRepo = {
    findByCartId: vi.fn().mockResolvedValue(initialOrderCartLink),
    create: vi.fn().mockResolvedValue({ id: 'ordcart_1' }),
  }
  const orderPaymentCollectionRepo = {
    create: vi.fn().mockResolvedValue({ id: 'ordpaycol_1' }),
  }
  const cartPaymentCollectionRepo = {
    findByCartId: vi.fn().mockResolvedValue({ id: 'cartpaycol_1', cartId: cart.id, paymentCollectionId: 'paycol_1' }),
  }
  const productVariantInventoryItemRepo = {
    findByVariantIds: vi.fn().mockResolvedValue(
      (options.variantMappings ?? [{ variantId: 'var_1', inventoryItemId: 'inv_1' }]).map((m) => ({
        id: `pvitem_${m.variantId}`,
        requiredQuantity: m.requiredQuantity ?? 1,
        createdAt: new Date(),
        deletedAt: null,
        ...m,
      })),
    ),
  }

  const dismissLinks = vi.fn().mockResolvedValue({})
  const linkService: ILinkService = {
    repo: ((name: string) => {
      const repos: Record<string, unknown> = {
        orderCart: orderCartRepo,
        orderPaymentCollection: orderPaymentCollectionRepo,
        cartPaymentCollection: cartPaymentCollectionRepo,
        productVariantInventoryItem: productVariantInventoryItemRepo,
      }
      return repos[name]
    }) as ILinkService['repo'],
    dismissLinks,
  }

  const container = createContainer()
  container.register({
    [Modules.CART]: asValue(cartService),
    [Modules.FULFILLMENT]: asValue(fulfillmentService),
    [Modules.PAYMENT]: asValue(paymentService),
    [Modules.ORDER]: asValue(orderService),
    [Modules.INVENTORY]: asValue(inventoryService),
    [ContainerRegistrationKeys.LINK]: asValue(linkService),
    [ContainerRegistrationKeys.LOGGER]: asValue(noopLogger),
  })

  setWorkflowEngine(createSimpleWorkflowEngine(), container)

  return {
    cart,
    cartService,
    paymentService,
    orderService,
    inventoryService,
    dismissLinks,
    orderCartRepo,
    orderPaymentCollectionRepo,
    productVariantInventoryItemRepo,
  }
}

describe('completeCartWorkflow', () => {
  test('happy path: creates order from cart, links, reserves inventory, and records transaction', async ({ dto }) => {
    const services = setupWorkflow(dto.generate)

    const result = await completeCartWorkflow.run({ cartId: services.cart.id })

    expect(result.id).toBe('ord_1')
    expect(result.status).toBe('pending')

    // Order was created with correct data
    expect(services.orderService.createOrder).toHaveBeenCalledOnce()
    const createOrderCall = services.orderService.createOrder.mock.calls[0]?.[0]
    expect(createOrderCall).toMatchObject({
      email: services.cart.email,
      customerId: 'cus_1',
      currencyCode: services.cart.currencyCode,
    })
    expect(createOrderCall.items).toHaveLength(1)
    expect(createOrderCall.shippingMethods).toHaveLength(1)

    // Links were created
    expect(services.orderCartRepo.create).toHaveBeenCalledWith({
      orderId: 'ord_1',
      cartId: services.cart.id,
    })
    expect(services.orderPaymentCollectionRepo.create).toHaveBeenCalledWith({
      orderId: 'ord_1',
      paymentCollectionId: 'paycol_1',
    })

    // Inventory was reserved
    expect(services.inventoryService.createReservationItems).toHaveBeenCalledOnce()

    // Transaction was recorded
    expect(services.orderService.addOrderTransaction).toHaveBeenCalledWith({
      orderId: 'ord_1',
      amount: expect.any(BigNumber),
      currencyCode: expect.any(String),
      reference: 'capture',
      referenceId: expect.any(String),
    })

    // Cart was completed
    expect(services.cartService.updateCart).toHaveBeenCalledWith(services.cart.id, {
      status: 'completed',
      completedAt: expect.any(Date),
    })
  })

  test('idempotency: returns existing order if order already linked', async ({ dto }) => {
    const cart = dto.generate.cart({ id: 'cart_1', status: 'completed', completedAt: new Date() })
    const services = setupWorkflow(dto.generate, {
      cart,
      orderCartLink: { orderId: 'ord_existing', cartId: cart.id },
    })

    const result = await completeCartWorkflow.run({ cartId: cart.id })

    expect(result.id).toBe('ord_1')
    expect(services.orderService.retrieveOrder).toHaveBeenCalledWith('ord_existing')
    expect(services.orderService.createOrder).not.toHaveBeenCalled()
    expect(services.cartService.updateCart).not.toHaveBeenCalled()
  })

  test('parses shipping method data from text to jsonb', async ({ dto }) => {
    const cart = dto.generate.cart({ id: 'cart_1' })
    const services = setupWorkflow(dto.generate, {
      cart,
      shippingMethods: [
        dto.generate.cartShippingMethod({
          cartId: cart.id,
          data: { provider: 'ups', rateId: 'R123' },
        }),
      ],
    })

    await completeCartWorkflow.run({ cartId: cart.id })

    const createOrderCall = services.orderService.createOrder.mock.calls[0]?.[0]
    const orderMethod = createOrderCall.shippingMethods[0]
    expect(orderMethod.data).toEqual({ provider: 'ups', rateId: 'R123' })
  })

  test('snapshots addresses without timestamps', async ({ dto }) => {
    const services = setupWorkflow(dto.generate, {
      address: dto.generate.cartAddress({ firstName: 'John', lastName: 'Smith' }),
    })

    await completeCartWorkflow.run({ cartId: services.cart.id })

    expect(services.orderService.createOrderAddresses).toHaveBeenCalledOnce()
    const addressInput = services.orderService.createOrderAddresses.mock.calls[0]?.[0][0]
    expect(addressInput).toMatchObject({
      firstName: 'John',
      lastName: 'Smith',
    })
    expect(addressInput).not.toHaveProperty('id')
    expect(addressInput).not.toHaveProperty('createdAt')
    expect(addressInput).not.toHaveProperty('updatedAt')
    expect(addressInput).not.toHaveProperty('deletedAt')
  })

  test('handles cart with no addresses', async ({ dto }) => {
    const services = setupWorkflow(dto.generate, {
      cart: dto.generate.cart({ shippingAddressId: null, billingAddressId: null }),
      address: null,
    })

    await completeCartWorkflow.run({ cartId: services.cart.id })

    expect(services.orderService.createOrderAddresses).not.toHaveBeenCalled()
    expect(services.orderService.createOrder).toHaveBeenCalledOnce()
    const createOrderCall = services.orderService.createOrder.mock.calls[0]?.[0]
    expect(createOrderCall.shippingAddressId).toBeUndefined()
    expect(createOrderCall.billingAddressId).toBeUndefined()
  })

  test('compensation: deletes order and dismisses links when record-transaction fails', async ({ dto }) => {
    const services = setupWorkflow(dto.generate)

    // Make addOrderTransaction fail to trigger compensation
    services.orderService.addOrderTransaction.mockRejectedValue(new Error('Transaction recording failed'))

    await expect(completeCartWorkflow.run({ cartId: services.cart.id })).rejects.toThrow('Transaction recording failed')

    // Compensation should have dismissed links and deleted the order
    expect(services.dismissLinks).toHaveBeenCalledWith({ orderId: ['ord_1'] })
    expect(services.orderService.deleteOrders).toHaveBeenCalledWith(['ord_1'])
  })

  test('rejects line items without variants', async ({ dto }) => {
    const cart = dto.generate.cart()
    setupWorkflow(dto.generate, {
      cart,
      lineItems: [dto.generate.cartLineItem({ cartId: cart.id, variantId: null })],
    })

    await expect(completeCartWorkflow.run({ cartId: cart.id })).rejects.toThrow('has no variant')
  })

  test('rejects cart without email', async ({ dto }) => {
    const cart = dto.generate.cart({ email: null })
    setupWorkflow(dto.generate, { cart })

    await expect(completeCartWorkflow.run({ cartId: cart.id })).rejects.toThrow(
      'has no email — an email is required to complete checkout',
    )
  })
})

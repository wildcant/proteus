import { BigNumber } from '@core/db/bignum.js'
import type { OrderDTO, OrderLineItemDTO } from '@core/types/order/common.js'
import type {
  CreateOrderAddressDTO,
  CreateOrderDTO,
  CreateOrderLineItemDTO,
  CreateOrderShippingMethodDTO,
  CreateOrderTransactionDTO,
} from '@core/types/order/mutations.js'
import { faker } from '@faker-js/faker'

export function generateOrderDTO(overrides?: Partial<OrderDTO>): OrderDTO {
  return {
    id: `ord_${faker.string.alphanumeric(32)}`,
    displayId: faker.number.int({ min: 1, max: 99999 }),
    status: 'pending',
    fulfillmentStatus: 'unfulfilled',
    email: faker.internet.email(),
    customerId: null,
    currencyCode: 'usd',
    shippingAddressId: null,
    billingAddressId: null,
    canceledAt: null,
    createdAt: faker.date.recent(),
    updatedAt: faker.date.recent(),
    deletedAt: null,
    ...overrides,
  }
}

export function generateOrderLineItemDTO(overrides?: Partial<OrderLineItemDTO>): OrderLineItemDTO {
  return {
    id: `ordli_${faker.string.alphanumeric(32)}`,
    orderId: `ord_${faker.string.alphanumeric(32)}`,
    title: faker.commerce.productName(),
    subtitle: null,
    thumbnail: null,
    quantity: faker.number.int({ min: 1, max: 10 }),
    unitPrice: new BigNumber(faker.number.int({ min: 100, max: 100000 })),
    compareAtUnitPrice: null,
    variantId: null,
    productId: null,
    productTitle: null,
    productDescription: null,
    productSubtitle: null,
    productType: null,
    productHandle: null,
    variantSku: null,
    variantBarcode: null,
    variantTitle: null,
    variantOptionValues: null,
    requiresShipping: true,
    createdAt: faker.date.recent(),
    updatedAt: faker.date.recent(),
    deletedAt: null,
    ...overrides,
  }
}

export function generateCreateOrderDTO(overrides?: Partial<CreateOrderDTO>): CreateOrderDTO {
  return {
    currencyCode: 'usd',
    email: 'customer@example.com',
    ...overrides,
  }
}

export function generateCreateOrderLineItemDTO(overrides?: Partial<CreateOrderLineItemDTO>): CreateOrderLineItemDTO {
  return {
    title: 'Test Product',
    quantity: 1,
    unitPrice: new BigNumber(10000),
    ...overrides,
  }
}

export function generateCreateOrderShippingMethodDTO(
  overrides?: Partial<CreateOrderShippingMethodDTO>,
): CreateOrderShippingMethodDTO {
  return {
    name: 'Standard Shipping',
    amount: new BigNumber(500),
    ...overrides,
  }
}

export function generateCreateOrderTransactionDTO(
  overrides?: Partial<CreateOrderTransactionDTO>,
): CreateOrderTransactionDTO {
  return {
    orderId: overrides?.orderId ?? '',
    amount: new BigNumber(10500),
    currencyCode: 'usd',
    reference: 'capture',
    ...overrides,
  }
}

export function generateCreateOrderAddressDTO(overrides?: Partial<CreateOrderAddressDTO>): CreateOrderAddressDTO {
  return {
    firstName: 'John',
    lastName: 'Doe',
    address1: '123 Main St',
    city: 'Springfield',
    countryCode: 'us',
    postalCode: '12345',
    ...overrides,
  }
}

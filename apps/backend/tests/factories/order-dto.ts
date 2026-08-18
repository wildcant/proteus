import { BigNumber } from '@core/db/bignum.js'
import type {
  CreateOrderAddressDTO,
  CreateOrderDTO,
  CreateOrderLineItemDTO,
  CreateOrderShippingMethodDTO,
  CreateOrderTransactionDTO,
} from '@core/types/order/mutations.js'

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
